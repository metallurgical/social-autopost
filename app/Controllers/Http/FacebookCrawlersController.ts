import {HttpContextContract} from "@ioc:Adonis/Core/HttpContext";
import {facebook} from '../../../services/facebook';
import {rules, schema} from '@ioc:Adonis/Core/Validator'
// import Redis from "@ioc:Adonis/Addons/Redis";
import Database from "@ioc:Adonis/Lucid/Database";

export default class FacebookCrawlersController {
  public async test() {
    // console.log('trigger from testsocket')
    // await Redis.set('foo1', 'bar1')
    // const value = await Redis.get('foo1');
    //
    // console.log(value)
    //
    // await Redis.publish('autopost_database_user', '1:require_verification_code');
    let user = await Database
      .from('users')
      .select('email')
      .where('id', 1)
      .first();

    console.log(user.email);
    return 'handled';
  }

  public async checkLogin(ctx: HttpContextContract) {
    const validationRules = schema.create({
      email: schema.string({}, [
        rules.email(),
      ]),
      password: schema.string(),
      password_replacement: schema.string(),
      user_id: schema.string(),
    });

    const payload = await ctx.request.validate({schema: validationRules});

    const responseObj = await facebook.isAbleToLogin({
      email: payload.email,
      password: payload.password,
      userId: payload.user_id,
      password_replacement: payload.password_replacement,
    });

    await facebook.closeBrowser(facebook.browser);

    console.log('done checking...');

    return ctx.response.send({
      status: responseObj.status,
      data: responseObj.reason,
      field: 'field' in responseObj ? responseObj.field : '',
      value: 'value' in responseObj ? responseObj.value : '',
    });
  }

  public async groups(ctx: HttpContextContract) {

    const validationRules = schema.create({
      email: schema.string({}, [
        rules.email(),
      ]),
      password: schema.string(),
    });

    const payload = await ctx.request.validate({schema: validationRules})

    const flagLogin = await facebook.login({email: payload.email, password: payload.password});

    if (!flagLogin) {
      return ctx.response.send({
        status: 'failed',
        data: false,
      });
    }

    const groups = await facebook.groups(facebook.page);

    await facebook.closeBrowser(facebook.browser);

    return ctx.response.send({
      status: 'success',
      data: groups,
    });
  }

  public async post(ctx: HttpContextContract) {
    const validationRules = schema.create({
      email: schema.string({}, [
        rules.email(),
      ]),
      password: schema.string(),
      groups: schema.array().members(schema.object().members({
        link: schema.string(),
      })),
      images: schema.array().members(schema.string()),
      message: schema.string(),
    });

    const payload = await ctx.request.validate({schema: validationRules})

    const page = await facebook.login({
      email: payload.email,
      password: payload.password,
      timeout: 10000
    });

    // Get all groups from request later
    const groups = payload.groups;

    if (!groups.length) {
      return ctx.response.status(403).send({
        status: 'failed',
        message: 'Operation failed, no groups specified',
      })
    }

    // Start post into groups
    await facebook.post({
      message: payload.message,
      page: page,
      images: payload.images,
      groups: payload.groups,
    });

    await facebook.closeBrowser(facebook.browser);

    return ctx.response.status(200).send({
      status: 'success',
      message: 'Successfully post into group',
    })
  }
}
