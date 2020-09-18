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

const legendesqueUrls = 
  [ 'https://legendesque.com/product/lord-of-the-rings-lcg-the-battle-of-lake-town/',
    'https://legendesque.com/product/lord-of-the-rings-lcg-murder-at-the-prancing-pony/',
    'https://legendesque.com/product/lord-of-the-rings-lcg-passage-through-mirkwood-nightmare-deck/',
    'https://legendesque.com/product/lord-of-the-rings-lcg-journey-down-the-anduin-nightmare-deck/',
    'https://legendesque.com/product/lord-of-the-rings-lcg-escape-from-dol-guldur-nightmare-deck/,'
    'https://legendesque.com/product/lord-of-the-rings-lcg-the-hunt-for-gollum-nightmare-deck/',
    'https://legendesque.com/product/lord-of-the-rings-lcg-conflict-at-the-carrock-nightmare-deck/',
    'https://legendesque.com/product/lord-of-the-rings-lcg-a-journey-to-rhosgobel-nightmare-deck/',
    'https://legendesque.com/product/lord-of-the-rings-lcg-the-hills-of-emyn-muil-nightmare-deck/',
    'https://legendesque.com/product/lord-of-the-rings-lcg-the-dead-marshes-nightmare-deck/',
    'https://legendesque.com/product/lord-of-the-rings-lcg-return-to-mirkwood-nightmare-deck/'
    ];  
//'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Shadow_And_Flame_Adventure_Pack.html',

const ffgSKUs = [
  {
    sku: 'uMEC35',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/the-battle-of-lake-town/',
  },
  
  {
    sku: 'uMEC64',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/murder-prancing-pony/',
  },
  
  {
    sku: 'uMEN01',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/passage-through-mirkwood/',
  },
 
  {
    sku: 'uMEN02',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/journey-along-the-anduin/',
  },
  
  {
    sku: 'uMEN03',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/escape-from-dol-guldur/',
  },
  
  {
    sku: 'uMEN04',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/the-hunt-for-gollum-1/',
  },
  
  {
    sku: 'uMEN05',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/conflict-at-the-carrock-1/',
  },
  
  {
    sku: 'uMEN06',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/a-journey-to-rhosgobel-1/,
  },      
   
  {
    sku: 'uMEN07',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/the-hills-of-emyn-muil-1/',
  },
  {
    sku: 'uMEN08',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/the-hills-of-emyn-muil-1/',
   },      
   
   {
    sku: 'uMEN09',
    url:
      'https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/return-to-mirkwood-1/',
   }
];

const isResponseSuccessful = response => response.status === 200 && Boolean(response.data);
const areItemsAvailable = items => items.length > 0;

const isItemInStockOnLegendesque = html => {
  const $ = cheerio.load(html);
  return !$('p[class="stock out-of-stock"]').length;  
  //return !$('img[src="v8outofstock.gif"]').length;
};

const isItemInStockOnFfg = responseData => responseData['in_stock'] === 'available';

// Legendesque scraper stream
const legendesque$ = from(legendesqueUrls).pipe(
  map(url => from(axios.get(url))),
  mergeAll(),
  filter(response => isResponseSuccessful(response) && isItemInStockOnLegendesque(response.data)),
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

const mergedStreams$ = merge(legendesque$, ffgApi$);
mergedStreams$.subscribe(
  inStockUrls => areItemsAvailable(inStockUrls) && sendEmail(createEmail(inStockUrls))
);
