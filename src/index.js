const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const { from, merge } = require('rxjs');
const { map, mergeAll, filter, toArray } = require('rxjs/operators');
require('dotenv').config();

const sendEmail = async html => {
  try {
    let transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.SCRAPER_USERNAME,
        pass: process.env.SCRAPER_PASSWORD,
      },
    });

    // setup email data with unicode symbols
    let mailOptions = {
      from: process.env.SCRAPER_USERNAME, // sender address
      to: process.env.SCRAPER_TARGET_EMAIL, // list of receivers
      subject: 'LotR items in stock!', // Subject line
      html,
    };

    // send mail with defined transport object
    let info = await transporter.sendMail(mailOptions);

    console.log('Message sent: %s', info.messageId);
  } catch (e) {
    console.error(e);
  }
};

const createEmail = inStockUrls => {
  return `<ul>${inStockUrls.reduce((string, url) => {
    return `${string}<li><a href="${url}">${url}</a></li>`;
  }, '')}</ul>`;
};

const gamesLoreUrls = [
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Hobbit_On_The_Doorstep_Saga_Expansion.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Stewards_Fear_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Morgul_Vale_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Assault_On_Osgiliath_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Mumakil_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Race_Across_Harad_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Beneath_The_Sands_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Black_Serpent_Adventure_Pack.html',
];

const ffgSKUs = [];

const isResponseSuccessful = response => response.status === 200 && Boolean(response.data);
const areItemsAvailable = items => items.length > 0;

const isItemInStockOnGamesLore = html => {
  const $ = cheerio.load(html);
  return !$('img[src="v8outofstock.gif"]').length;
};

const isItemInStockOnFfg = responseData => responseData['in_stock'] === 'available';

// GamesLore scraper stream
const gamesLore$ = from(gamesLoreUrls).pipe(
  map(url => from(axios.get(url))),
  mergeAll(),
  filter(response => isResponseSuccessful(response) && isItemInStockOnGamesLore(response.data)),
  map(inStockResponse => inStockResponse.config.url),
  toArray()
);

// FFG API consumer stream
const ffgApi$ = from(ffgSKUs).pipe(
  map(({ sku, url }) =>
    from(
      axios.get(`https://shop.fantasyflightgames.com/api/v1/stockrecord/${sku}/level/`, {
        responseType: 'json',
        transformResponse: data => Object.assign({}, JSON.parse(data), { sku, url }),
      })
    )
  ),
  mergeAll(),
  filter(response => isResponseSuccessful(response) && isItemInStockOnFfg(response.data)),
  map(inStockResponse => inStockResponse.data.url),
  toArray()
);

const mergedStreams$ = merge(gamesLore$, ffgApi$);
mergedStreams$.subscribe(
  inStockUrls => areItemsAvailable(inStockUrls) && sendEmail(createEmail(inStockUrls))
);
