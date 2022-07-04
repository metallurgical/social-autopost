import Env from "@ioc:Adonis/Core/Env";

const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

var facebook = {
  browser: null,
  async login({email, password, timeout = 6000}) {
    const browser = await this.launchBrowser();
    const page = await this.launchPage(browser);

    // Listen to console event
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Set default navigation
    page.setDefaultNavigationTimeout(timeout);

    await page.goto('https://m.facebook.com');
    await page.type('#m_login_email', email);
    await page.type('#m_login_password', password);
    await page.click("button[name='login']");
    await page.waitForNavigation();

    return page;
  },

  async groups(page) {
    await page.goto(Env.get('FACEBOOK_ENDPOINT') + '/groups_browse/your_groups/');

    await this.autoScroll(page);

    // Get ID root container
    const $rootContainerElement = await page.$('#rootcontainer');
    const rawHtml = await $rootContainerElement.getProperty('innerHTML');

    // Loaded into cheerio
    const $ = cheerio.load(await rawHtml.jsonValue());

    const $groupImages = $("img[alt='group image link']");

    let groups: any[] = [];

    $groupImages.each(function (_index, elem) {
      let link = $(elem).parent('div').parent('div').parent('a').attr('href');

      groups.push({
        image: $(elem).attr('src').replace('&amp;', '&'),
        link: link,
        id: link.replace(/[^0-9]/g, ''),
        name: $(elem).next('div').children('div').first().find('div').text(),
      });
    });

    return groups;
  },

  async post({page, message, images, groups}) {
    if (!groups.length) {
      return false;
    }
    groups.forEach(async function (elem) {
      // @ts-ignore
      await page.goto(Env.get('FACEBOOK_ENDPOINT') + elem.link);

      // Click trigger button input
      await page.click('.feedRevamp > div:nth-of-type(3) > div > div:nth-of-type(1) > div[role="button"]:nth-of-type(2)');

      // Wait for textarea visible to page
      await page.waitForSelector(".mentions > textarea.mentions-input", {visible: true});
      //
      // Insert into textarea
      await page.type('.mentions > textarea.mentions-input', message);

      if (images.length) {
        const uploadField = await page.$('#photo_input');
        await uploadField.uploadFile(...images);
      }

      await page.click('form#structured_composer_form + div button[value="Post"]');
    });

    return true;

    // const groups = [
    //   {
    //     "image": "https://scontent.fkul15-1.fna.fbcdn.net/v/t39.30808-6/218773886_670375117696544_6809887041423044143_n.jpg?stp=c0.7.64.64a_cp0_dst-jpg_e15_p64x64_q65&_nc_cat=104&ccb=1-7&_nc_sid=70495d&efg=eyJpIjoidCJ9&_nc_ohc=Jld4t_rTbjMAX9Excxr&_nc_ht=scontent.fkul15-1.fna&oh=00_AT-ZHGTY1EE5jcoJujsVw0edfvRkLG2R-QHiFCN8VfCR2w&oe=62C5D13F",
    //     "link": "/groups/4088886357826197/?ref=group_browse",
    //     "id": "4088886357826197",
    //     "name": "orang yg suka main dirnjang puas",
    //   }
    // ];

    // await page.goto('https://m.facebook.com/groups/3441246705987374/?ref=group_browse');
    //
    // // Click trigger button input
    // await page.click('.feedRevamp > div:nth-of-type(3) > div > div:nth-of-type(1) > div[role="button"]:nth-of-type(2)');
    //
    // // Wait for textarea visible to page
    // await page.waitForSelector(".mentions > textarea.mentions-input", {visible: true});
    // //
    // // Insert into textarea
    // await page.type('.mentions > textarea.mentions-input', 'Hai jom sembang kosong2');
    //
    // // const filePath = path.relative(process.cwd(),'/cat-2.jpeg');
    //
    // const images = [
    //   "/Users/metallurgical/projects/autopost-crawler/cat-2.jpeg",
    //   "https://i.pinimg.com/236x/9f/b8/6b/9fb86b2fe6c7abdcc498115815bfaab7.jpg",
    // ];
    //
    // const uploadField = await page.$('#photo_input');
    // await uploadField.uploadFile(...images);
    //
    // await page.click('form#structured_composer_form + div button[value="Post"]');
  },

  getBrowser() {
    return this.browser;
  },

  async launchPage(browser) {
    return await browser.newPage();
  },

  async launchBrowser() {
    // this.browser =  await puppeteer.launch({headless: false, args: ['--start-maximized']});
    this.browser = await puppeteer.launch();

    return this.browser;
  },

  async closeBrowser(browser) {
    await browser ? browser!.close() : this.browser.close();
  },

  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        var totalHeight = 0;
        var distance = 100;
        var timer = setInterval(() => {
          var scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve(0);
          }
        }, 400);
      });
    });
  },

  async getDomElement(page, selector) {
    return await page.$(selector);
  }
}

export {facebook};
