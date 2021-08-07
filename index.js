const express = require('express');
const redis = require('redis');
const sitemapper = require('sitemapper');
const puppeteer = require('puppeteer');
const CronJob = require('cron').CronJob;
const { Cluster } = require('puppeteer-cluster');

require('dotenv').config();

const redisClient = redis.createClient();
const app = express();
const sitemap = new sitemapper();

let cluster = undefined;

let isRunning = false;

var job = new CronJob(
    '0 20 3 * * *',
    () => {
        startProcess();
    },
    null,
    true,
);

async function init() {
    cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 10,
    });
    await cluster.task(async ({ page, data: url }) => {
        try {
            console.log(url);
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 180 * 1000,
            });
            const content = await page.content();
            const status = await redisClient.set(
                `prerender:${url}`,
                content,
            );
            console.log(url, status, content.length);
        } catch (e) {
            console.log(e);
        }
    });
}

app.get('/url/*', async (req, res) => {
    console.log(req.params[0]);
    redisClient.get(`prerender:${req.params[0]}`, (err, content) => {
        res.send(content);
    });
});

app.get('/start', async (req, res) => {
    startProcess();
    res.send('Process Started');
});

async function startProcess() {
    if (isRunning) {
        return false;
    }

    isRunning = true;
    await init();
    sitemap.fetch(process.env.SITEMAP).then(async (data) => {
        for await (const site of data.sites) {
            await cluster.queue(site);
        }
        await cluster.idle();
        await cluster.close();
        isRunning = false;
    });
}

app.listen(process.env.PORT, () => {
    console.log(`App listening at http://localhost:${process.env.PORT}`);
});
