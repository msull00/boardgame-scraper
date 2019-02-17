const axios = require('axios');
const cheerio = require('cheerio');

const scrapeForInStockItem = (url, html) => {
  const $ = cheerio.load(html);
  const itemInStock = !$('img[src="v8outofstock.gif"]').length;
  console.log(url, itemInStock);
};

const urls = [
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_Living_Card_Game_LCG_Core_Set.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Khazad-Dum_Campaign_Expansion.html',
];

const promises = urls.map(url => axios.get(url));

Promise.all(promises).then(responses => {
  responses.forEach(response => {
    if (response.status !== 200) {
      return;
    }

    scrapeForInStockItem(response.config.url, response.data);
  });
});
