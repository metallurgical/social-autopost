import {HttpContextContract} from "@ioc:Adonis/Core/HttpContext";
import {facebook} from '../../../services/facebook';
import {rules, schema} from '@ioc:Adonis/Core/Validator'

export default class FacebookCrawlersController {
  public async groups(ctx: HttpContextContract) {

    const validationRules = schema.create({
      email: schema.string({}, [
        rules.email(),
      ]),
      password: schema.string(),
    });

    const payload = await ctx.request.validate({schema: validationRules})

    const page = await facebook.login({email: payload.email, password: payload.password});
    const groups = await facebook.groups(page);

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
  }
}
