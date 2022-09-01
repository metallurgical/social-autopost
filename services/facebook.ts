import Env from "@ioc:Adonis/Core/Env";

const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
import {PageHelper} from './page/helper';
import Redis from "@ioc:Adonis/Addons/Redis";
import Database from "@ioc:Adonis/Lucid/Database";
import {DateTime} from "luxon";
// import Database from '@ioc:';

var browserHelper = new PageHelper();

var facebook = {

  browser: null,
  page: null,

  async login({email, password, timeout = 6000}) {
    if (Env.get('DEBUG_ENABLED') == 'true') {
      console.log('Enter check login');
    }
    this.browser = await browserHelper.init();
    this.page = browserHelper.page;
    await browserHelper.open('https://m.facebook.com');

    await browserHelper.focusElement('#m_login_email');
    await browserHelper.clearElement('#m_login_email');
    await browserHelper.sendElementText('#m_login_email', email);
    await browserHelper.focusElement('#m_login_password');
    await browserHelper.clearElement('#m_login_password');
    await browserHelper.sendElementText('#m_login_password', password);

    // Set default navigation
    await browserHelper.setDefaultNavigationTimeout(timeout);
    await browserHelper.clickElement("button[name='login']");

    let flagNavigationError: boolean = false;

    // Wait for facebook redirect after successful login
    await browserHelper.waitForNavigation()
      .catch(() => {
        flagNavigationError = true;
      });

    let url = browserHelper.page.url();

    if (Env.get('DEBUG_ENABLED') == 'true') {
      console.log('Check login done');
    }

    // If facebook ask for "log in with one tap", just click not now button
    if (url.includes('https://m.facebook.com/login/save-device')) {
      if (Env.get('DEBUG_ENABLED') == 'true') {
        console.log('Require save device');
      }

      let flagLoginWithOneTap = true;

      await browserHelper
        .page
        .waitForXPath('//*[contains(text(), "Log in with one tap")]', {timeout: 6000}).catch(() => {
          flagLoginWithOneTap = false;
        });

      // If true, click on "not now" button
      if (flagLoginWithOneTap) {
        if (Env.get('DEBUG_ENABLED') == 'true') {
          console.log('flagLoginWithOneTap');
        }

        await browserHelper.open(Env.get('FACEBOOK_ENDPOINT') + '/login/save-device/cancel/?flow=interstitial_nux&nux_source=regular_login');

        // If success redirect
        if (url === Env.get('FACEBOOK_ENDPOINT')) {
          if (Env.get('DEBUG_ENABLED') == 'true') {
            console.log('Url matched, yahooo');
          }

          return this.page;
        }
      }
    }

    if (flagNavigationError) {
      let flagForgotPasswordError: boolean = true;
      let flagHelpFindAccountError: boolean = true;
      let flagCantFindAccountError: boolean = true;

      await browserHelper
        .page
        .waitForXPath('//*[contains(text(), "Did you forget your password?")]', {timeout: 6000}).catch(() => {
          flagForgotPasswordError = false;
        });

      if (flagForgotPasswordError) {
        return false;
      }

      await browserHelper
        .page
        .waitForXPath('//*[contains(text(), "Need help with finding your account?")]', {timeout: 6000})
        .catch(() => {
          flagHelpFindAccountError = false;
        });

      if (flagHelpFindAccountError) {
        return false;
      }

      await browserHelper
        .page
        .waitForXPath('//*[contains(text(), "Can\'t find account")]', {timeout: 6000}).catch(() => {
          flagCantFindAccountError = false;
        });

      if (flagCantFindAccountError) {
        return false;
      }
    }

    return this.page;
  },

  async isAbleToLogin({email, password, userId, password_replacement}) {
    const flagLogin = await this.login({email: email, password: password})

    if (!flagLogin) {
      return {
        'status': 'failed',
        'reason': 'login_failed',
      };
    }

    if (Env.get('DEBUG_ENABLED') == 'true') {
      console.log('pass login');
    }

    // Wait for facebook redirect after successful login
    await browserHelper.waitForNavigation()
      .catch(() => {
        if (Env.get('DEBUG_ENABLED') == 'true') {
          console.log('No navigation occur. Skip');
        }
      });

    let url = browserHelper.page.url();

    if (Env.get('DEBUG_ENABLED') == 'true') {
      console.log('checking url: ' + url);
    }

    // If require checkpoint but still not redirect to that page
    // Make it redirect
    if (url.includes('https://m.facebook.com/login.php?next=https://m.facebook.com/checkpoint')) {
      if (Env.get('DEBUG_ENABLED') == 'true') {
        console.log('Next redirect still not occur')
      }

      let next = this.getAllUrlParams(url).next;

      if (next) {
        if (Env.get('DEBUG_ENABLED') == 'true') {
          console.log('Redirect to : ' + next);
        }

        browserHelper.page.goto(next);
      }
    }

    await browserHelper.waitForNavigation()
      .catch(() => {
        if (Env.get('DEBUG_ENABLED') == 'true') {
          console.log('No navigation occur. Skip');
        }
      });

    url = browserHelper.page.url();

    // Because of browser dont recognise device or location
    if (url.includes('https://m.facebook.com/checkpoint')) {
      if (Env.get('DEBUG_ENABLED') == 'true') {
        console.log('require checkpoint');
      }

      // 1st. Facebook directly ask to verify location and after that require to create password
      let isCheckLoginDetail = true;
      let isCreateNewPassword = true;
      let isFirstCheckAbleToLogin = false;
      let isLoginApprovalNeeded = true;

      // Check if require to verify login
      if (Env.get('DEBUG_ENABLED') == 'true') {
        console.log('check for login approval text');
      }

      await browserHelper
        .page
        .waitForXPath('//*[contains(text(), "Login approval needed")]', {timeout: 1000})
        .catch(() => {
          // False means, not found this text
          isLoginApprovalNeeded = true;
        });

      if (isLoginApprovalNeeded) {
        if (Env.get('DEBUG_ENABLED') == 'true') {
          console.log('require login approval');
        }

        // Click on "continue" button
        await browserHelper.page.click('#checkpointSubmitButton-actual-button');

        // Usually once enter this part, directly enter to login page
      }

      // Check if require to verify login
      if (Env.get('DEBUG_ENABLED') == 'true') {
        console.log('check for check the login detail text');
      }

      await browserHelper
        .page
        .waitForXPath('//*[contains(text(), "Check the login details shown. Was it you?")]', {timeout: 1000})
        .catch(() => {
          // False means, not found this text
          isCheckLoginDetail = false;
        });

      // If yes, click "Yes" button and proceed to next page
      if (isCheckLoginDetail) {
        if (Env.get('DEBUG_ENABLED') == 'true') {
          console.log('require check login detail');
        }

        await browserHelper.page.click('#checkpointSubmitButton-actual-button');

        // Check whether is require to create new password page
        if (Env.get('DEBUG_ENABLED') == 'true') {
          console.log('check create new password text');
        }

        await browserHelper
          .page
          .waitForXPath('//*[contains(text(), "Create a new password")]', {timeout: 1000})
          .catch(() => {
            // False means, not found this text
            isCreateNewPassword = false;
          });

        // If found page "create a new password"
        if (isCreateNewPassword) {
          if (Env.get('DEBUG_ENABLED') == 'true') {
            console.log('require create new password');
          }

          // Insert new password
          await browserHelper.page.type('[name="password_new"]', password_replacement)

          // Press Enter Key
          await browserHelper.page.keyboard.press('Enter');

          // Re-try login again
          const flagLogin2nd = await this.checkIsSuccessLogin(browserHelper);

          if (flagLogin2nd) {
            isFirstCheckAbleToLogin = true;
          }

          if (!isFirstCheckAbleToLogin) {
            // Check for "Choose your account" text
            if (Env.get('DEBUG_ENABLED') == 'true') {
              console.log('Check for choose your account text')
            }

            let flagChooseYourAccount = true;

            await browserHelper
              .page
              .waitForXPath('//*[contains(text(), "Choose your account")]', {timeout: 3000})
              .catch(() => {
                flagChooseYourAccount = false;
              });

            if (flagChooseYourAccount) {
              if (Env.get('DEBUG_ENABLED') == 'true') {
                console.log('Need to choose account')
              }

              await browserHelper.page.evaluate(() => {
                // @ts-ignore
                document.querySelector('[data-sigil="login_profile_form"]').click();
              });

              await browserHelper.page.waitForNavigation();

              let checkUrl = browserHelper.page.url();

              // Require to login using password again
              if (checkUrl.includes('m.facebook.com/login/device-based/password')) {
                if (Env.get('DEBUG_ENABLED') == 'true') {
                  console.log('Require to login again using new password')
                }

                await browserHelper.page.type('[name="pass"]', isCreateNewPassword ? password_replacement : password);

                // Press Enter Key
                await browserHelper.page.keyboard.press('Enter');

                await browserHelper.page.waitForNavigation().catch(() => {
                });

                // Re-try login again
                const flagLogin3rd = await this.checkIsSuccessLogin(browserHelper);

                if (flagLogin3rd) {
                  return {
                    status: 'success',
                    reason: 'success_login',
                    field: 'password_replacement',
                    value: password_replacement,
                  }
                }
              }
            }
          } else {
            // 1st check already success
            if (Env.get('DEBUG_ENABLED') == 'true') {
              console.log('1st check able to login in already');
            }

            return {
              status: 'success',
              reason: 'success_login',
              field: 'password_replacement',
              value: password_replacement,
            }
          }
        }
      }

      let flagGetCodeSentToEmail = true;

      // 2. Proceed to 2nd step if 1st step failed!
      if (Env.get('DEBUG_ENABLED') == 'true') {
        console.log('check code sent to your email address');
      }

      await browserHelper
        .page
        .waitForXPath('//*[contains(text(), "Get a code sent to your email address")]', {timeout: 1000})
        .catch(() => {
          // Directly failed, since there no other option out there.
          flagGetCodeSentToEmail = false;
        });

      if (flagGetCodeSentToEmail) {
        if (Env.get('DEBUG_ENABLED') == 'true') {
          console.log('require code sent to your email address');
        }

        // Click "get a code sent email address"
        await browserHelper.page.evaluate(() => {
          // @ts-ignore
          document.querySelector("input[name='verification_method'][value='37']").click();
        });

        // Proceed with by email
        await browserHelper.page.click('#checkpointSubmitButton-actual-button');

        if (Env.get('DEBUG_ENABLED') == 'true') {
          console.log('check have a code sent to your email address');
        }

        await browserHelper
          .page
          .waitForXPath('//*[contains(text(), "Have a code sent to your email address")]', {timeout: 6000})
          .catch(() => {
            // Directly failed, since there no other option out there.
            return {
              'status': 'failed',
              'reason': 'checkpoint_not_found_have_code_sent_email',
            };
          });

        // Proceed with selected email
        await browserHelper.page.click('#checkpointSubmitButton-actual-button');

        // Send signal to laravel app login require verification code
        if (Env.get('DEBUG_ENABLED') == 'true') {
          console.log('Publish redis pub sub with user Id: ' + userId);
          console.log('Publish redis pub sub with channel: ' + (Env.get('REDIS_CHANNEL_PREFIX') + 'user'));
        }

        await Redis.publish(Env.get('REDIS_CHANNEL_PREFIX') + 'user', userId + ':require_verification_code');

        // Keep running get the data from db (user must send verification code via app)
        let keepRunning = true;

        // Recursively get facebook verification code from users table
        // user must enter this code within 2 minutes.
        let endTime = DateTime.local().plus({minute: 1});

        let facebookVerificationCode = null;

        if (Env.get('DEBUG_ENABLED') == 'true') {
          console.log('require verification code');
        }

        do {
          let user = await Database
            .from('users')
            .select('facebook_verification_code')
            .where('id', userId)
            .first();

          if (user.facebook_verification_code) {
            console.log('Received verification code');
            facebookVerificationCode = user.facebook_verification_code;
            keepRunning = false;
            break;
          }

          // If exceed 2 minutes, let failing this process
          if (DateTime.local() > endTime) {
            keepRunning = false;
            break;
          }

        } while (keepRunning);

        // If success get facebookVerificationCode, let insert into facebook input and click
        if (!keepRunning && facebookVerificationCode) {
          await browserHelper
            .page
            // We've sent an 8-digit code to the email address that you chose. Please enter the code here once it has arrived.
            .waitForXPath('//*[contains(text(), "8-digit code to the email address that you chose")]', {timeout: 6000})
            .catch(() => {
            });

          if (Env.get('DEBUG_ENABLED') == 'true') {
            console.log('Insert verification code: ' + facebookVerificationCode);
          }

          // await browserHelper.page.type('[name="captcha_response"]', facebookVerificationCode);

          // await browserHelper.page.evaluate("document.querySelector('input[name=\"captcha_response\"]').value = " + facebookVerificationCode);
          await browserHelper.page.evaluate((facebookVerificationCode, debugEnabled) => {
            if (debugEnabled == 'true') {
              console.log('Received verification code from nodejs: ' + facebookVerificationCode)
            }
            // @ts-ignore
            document.querySelector("input[name='captcha_response']").value = facebookVerificationCode;
          }, facebookVerificationCode, Env.get('DEBUG_ENABLED'));

          if (Env.get('DEBUG_ENABLED') == 'true') {
            console.log('Submit');
          }
          // // Press enter key
          // await browserHelper.page.keyboard.press('Enter');

          // Proceed with yes
          await browserHelper.page.click('#checkpointSubmitButton-actual-button');

          // Check if require to verify login
          if (Env.get('DEBUG_ENABLED') == 'true') {
            console.log('re-check for check the login detail text');
          }

          let reCheckLoginDetailStep = true;

          await browserHelper
            .page
            .waitForXPath('//*[contains(text(), "Check the login details shown")]', {timeout: 6000})
            .catch(() => {
              // False means, not found this text
              reCheckLoginDetailStep = false;
            });

          if (reCheckLoginDetailStep) {
            if (Env.get('DEBUG_ENABLED') == 'true') {
              console.log('found text. Click yes button');
            }

            // Proceed with yes
            await browserHelper.page.click('#checkpointSubmitButton-actual-button');

            if (Env.get('DEBUG_ENABLED') == 'true') {
              console.log('Click yes button');
            }
          }

          // The code that you entered is incorrect. Please check the code we sent to your email.

          return {
            'status': 'failed',
            'reason': 'login_error',
          }
        }

        if (!keepRunning && !facebookVerificationCode) {
          return {
            'status': 'failed',
            'reason': 'checkpoint_exceed_waiting_2_minute',
          };
        }
      }
    }

    if (Env.get('DEBUG_ENABLED') == 'true') {
      console.log('all passed, redirect to profile account')
    }

    await browserHelper.open('https://m.facebook.com/settings/?tab=account');

    await browserHelper
      .waitForNavigation()
      .catch(() => {
        return {
          'status': 'failed',
          'reason': 'check_login_error_navigate_tab_account',
        };
      });

    url = browserHelper.page.url();

    let isSuccess = url.includes('https://m.facebook.com/settings/?tab=account');

    if (Env.get('DEBUG_ENABLED') == 'true') {
      console.log('success redirect to profile account')
    }

    return {
      'status': isSuccess ? 'success' : 'failed',
      'reason': isSuccess ? 'success_login' : 'check_login_error_navigate_tab_account',
    };


    // let ableToLogin = true;

    // // await browserHelper.open('https://m.facebook.com/groups/feed/');

    // await browserHelper
    //   .page
    //   .waitForXPath('//*[contains(text(), "Create group")]', {timeout: 6000})
    //   .catch(() => {
    //     // ableToLogin = false;
    //   });

    // return ableToLogin;
  },

  async checkIsSuccessLogin(browser) {
    let isSuccess = true;

    await browser.open('https://m.facebook.com/settings/?tab=account');
    await browser
      .waitForNavigation()
      .catch(() => {
        isSuccess = false;
      })

    if (!isSuccess) {
      return false;
    }

    let url = browser.page.url();

    return url.includes('https://www.facebook.com/settings/?tab=account');
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

    for (let index = 0; index < groups.length; ++index) {
      let elem = groups[index];

      // @ts-ignore
      await page.goto(Env.get('FACEBOOK_ENDPOINT') + elem.link);

      // Click trigger button input
      // await page.click('.feedRevamp > div:nth-of-type(3) > div > div:nth-of-type(1) > div[role="button"]:nth-of-type(2)'); --> no longer available
      await page.click('#MComposer > div > div > div:nth-of-type(1) > div[role="button"]');

      // Wait for textarea visible to page
      await page.waitForSelector(".mentions > textarea.mentions-input", {visible: true});
      //
      // Insert into textarea
      await page.type('.mentions > textarea.mentions-input', message);

      if (images.length) {
        const uploadField = await page.$('#photo_input');
        await uploadField.uploadFile(...images);
      }

      // await Promise.all([
      await page.click('form#structured_composer_form + div button[value="Post"]');

      // Wait for this text appear, if appear means our post is now published (see content if is being reviewed or not)
      await page
        .waitForXPath('//*[contains(text(), "Your post is now published")]', {timeout: 6000})
        .catch(() => {
          console.log('coundlt find')
        });

      // page.waitForSelector('[data-sigil="inprogress"]', {visible: false}),
      // ]);
      // await page.click('form#structured_composer_form + div button[value="Post"]');

      // await page.waitForResponse(response => response.status() === 200);
    }

    // Cant use await inside forEach, move to for statement like above
    // groups.forEach(async function (elem) {
    //   // @ts-ignore
    //   await page.goto(Env.get('FACEBOOK_ENDPOINT') + elem.link);
    //
    //   // Click trigger button input
    //   await page.click('.feedRevamp > div:nth-of-type(3) > div > div:nth-of-type(1) > div[role="button"]:nth-of-type(2)');
    //
    //   // Wait for textarea visible to page
    //   await page.waitForSelector(".mentions > textarea.mentions-input", {visible: true});
    //   //
    //   // Insert into textarea
    //   await page.type('.mentions > textarea.mentions-input', message);
    //
    //   if (images.length) {
    //     const uploadField = await page.$('#photo_input');
    //     await uploadField.uploadFile(...images);
    //   }
    //
    //   await page.click('form#structured_composer_form + div button[value="Post"]');
    // });

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
  },

  getAllUrlParams(url) {

    // get query string from url (optional) or window
    var queryString = url ? url.split('?')[1] : window.location.search.slice(1);

    // we'll store the parameters here
    var obj = {};

    // if query string exists
    if (queryString) {

      // stuff after # is not part of query string, so get rid of it
      queryString = queryString.split('#')[0];

      // split our query string into its component parts
      var arr = queryString.split('&');

      for (var i = 0; i < arr.length; i++) {
        // separate the keys and the values
        var a = arr[i].split('=');

        // set parameter name and value (use 'true' if empty)
        var paramName = a[0];
        var paramValue = typeof (a[1]) === 'undefined' ? true : a[1];

        // (optional) keep case consistent
        paramName = paramName.toLowerCase();
        if (typeof paramValue === 'string') paramValue = paramValue.toLowerCase();

        // if the paramName ends with square brackets, e.g. colors[] or colors[2]
        if (paramName.match(/\[(\d+)?\]$/)) {

          // create key if it doesn't exist
          var key = paramName.replace(/\[(\d+)?\]/, '');
          if (!obj[key]) obj[key] = [];

          // if it's an indexed array e.g. colors[2]
          if (paramName.match(/\[\d+\]$/)) {
            // get the index value and add the entry at the appropriate position
            var index = /\[(\d+)\]/.exec(paramName)[1];
            obj[key][index] = paramValue;
          } else {
            // otherwise add the value to the end of the array
            obj[key].push(paramValue);
          }
        } else {
          // we're dealing with a string
          if (!obj[paramName]) {
            // if it doesn't exist, create property
            obj[paramName] = paramValue;
          } else if (obj[paramName] && typeof obj[paramName] === 'string') {
            // if property does exist and it's a string, convert it to an array
            obj[paramName] = [obj[paramName]];
            obj[paramName].push(paramValue);
          } else {
            // otherwise add the property
            obj[paramName].push(paramValue);
          }
        }
      }
    }

    return obj;
  }
}

export {facebook};
