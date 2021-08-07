const express = require('express');
const redis = require('redis');
const puppeteer = require('puppeteer');

require('dotenv').config();

const redisClient = redis.createClient();
const app = express();
let browser = undefined;


app.get('/url/*', async (req, res) => {
    console.log(req.params[0]);
    redisClient.get(`prerender:${req.params[0]}`, async (err, content) => {
        if (!content) {
            const response = await preRender(req.params[0]);
            res.send(response);
        } else {
            res.send(content);
        }
    });
});

app.listen(process.env.PORT, () => {
    console.log(`App listening at http://localhost:${process.env.PORT}`);
});

async function preRender(url) {
    const content = await fetchPage(url);
    await redisClient.set(
        `prerender:${site}`,
        content,
    );
    return content;
}

async function fetchPage(url) {
    if (!browser) {
        throw 'Failed to initialize puppeteer';
    }
    const page = await browser.newPage();
    await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 180 * 1000,
    });
    return await page.content();
}

async function init() {
    browser = await puppeteer.launch();
}

init();