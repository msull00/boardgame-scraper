const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');

const sendEmail = async html => {
  try {
    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    let account = await nodemailer.createTestAccount();

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: account.user, // generated ethereal user
        pass: account.pass, // generated ethereal password
      },
    });

    // setup email data with unicode symbols
    let mailOptions = {
      from: 'test123@mailinator.com', // sender address
      to: 'test123@mailinator.com', // list of receivers
      subject: 'LotR items in stock!', // Subject line
      html,
    };

    // send mail with defined transport object
    let info = await transporter.sendMail(mailOptions);

    console.log('Message sent: %s', info.messageId);
    // Preview only available when sending through an Ethereal account
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (e) {
    console.error(e);
  }
};

const createEmail = inStockUrls => {
  return `<ul>${inStockUrls.reduce((string, url) => {
    return `${string}<li>${url}</li>`;
  }, '')}</ul>`;
};

const isItemInStock = html => {
  const $ = cheerio.load(html);
  return !$('img[src="v8outofstock.gif"]').length;
};

const urls = [
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_Living_Card_Game_LCG_Core_Set.html',
  'https://www.gameslore.com/acatalog/PR_The_Lord_Of_The_Rings_LCG_Khazad-Dum_Campaign_Expansion.html',
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
