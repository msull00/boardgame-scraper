const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
require('dotenv').config();

const sendEmail = async html => {
  try {
    let transporter = nodemailer.createTransport({
      service: 'hotmail',
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

const isItemInStock = html => {
  const $ = cheerio.load(html);
  return !$('img[src="v8outofstock.gif"]').length;
};

const urls = [
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Khazad-Dum_Campaign_Expansion.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Flame_Of_The_West_Saga_Expansion.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Road_Darkens_Expansion.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Conflict_At_The_Carrock_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Hunt_For_Gollum_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Dead_Marshes_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Return_to_Mirkwood_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Redhorn_Gate_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Shadow_And_Flame_Adventure_Pack.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Grey_Havens_Deluxe_Expansion.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Hobbit_On_The_Doorstep_Saga_Expansion.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Voice_of_Isengard_Expansion.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_The_Stewards_Fear_Adventure_Pack.html',
];

const promises = urls.map(url => axios.get(url));

Promise.all(promises).then(responses => {
  const itemsInStock = responses.reduce((items, response) => {
    if (response.status !== 200) {
      return items;
    }

    if (!isItemInStock(response.data)) {
      return items;
    }

    return [...items, response.config.url];
  }, []);

  if (itemsInStock.length) {
    console.log('There are items in stock!');
    sendEmail(createEmail(itemsInStock));
  }
});
