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

const gamesLoreUrls = 
  [
    'https://legendesque.com/product/lord-of-the-rings-lcg-return-to-mirkwood/',
    'https://legendesque.com/product/lord-of-the-rings-lcg-the-dread-realm/',
  ];  
//'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Shadow_And_Flame_Adventure_Pack.html',

const ffgSKUs = [
  {
    sku: 'MEC73',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/lord-rings-living-card-game-limited-collectors-edition/',
  },
 /* 
  {
    sku: 'MEC03',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/conflict-at-the-carrock/',
  },
  
   {
    sku: 'MEC05',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/the-hills-of-emyn-muil/',
  },
  
   {
    sku: 'MEC07',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/return-to-mirkwood/',
  },
  */
   {
    sku: 'MEC18',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/the-stewards-fear/',
  },
  
   {
    sku: 'MEC44',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/dread-realm/',
  },      
];

const isResponseSuccessful = response => response.status === 200 && Boolean(response.data);
const areItemsAvailable = items => items.length > 0;

const isItemInStockOnGamesLore = html => {
  const $ = cheerio.load(html);
  return !$('p[class='stock in-stock"]').length;  
  //return !$('img[src="v8outofstock.gif"]').length;
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
