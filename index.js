const express = require('express');
const redis = require('redis');
const sitemapper = require('sitemapper');
const puppeteer = require('puppeteer');
const CronJob = require('cron').CronJob;

require('dotenv').config();

const redisClient = redis.createClient();
const app = express();
const sitemap = new sitemapper();
let browser = undefined;
let page = undefined;

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
    browser = await puppeteer.launch();
    page = await browser.newPage();
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
        try {
            for await (const site of data.sites) {
                const content = await fetchPage(site);
                const status = await redisClient.set(
                    `prerender:${site}`,
                    content,
                );
                console.log(site, status, content.length);
            }
            await browser.close();
            isRunning = false;
        } catch (e) {
            console.log(e);
        }
    });
}

app.listen(process.env.PORT, () => {
    console.log(`App listening at http://localhost:${process.env.PORT}`);
});

async function fetchPage(url) {
    if (!browser || !page) {
        throw 'Failed to initialize puppeteer';
    }
    await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 180 * 1000,
    });
    return await page.content();
}
