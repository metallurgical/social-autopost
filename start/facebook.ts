import Route from "@ioc:Adonis/Core/Route";

Route.post('/facebook/groups', 'FacebookCrawlersController.groups').as('facebook.groups');
Route.post('/facebook/check-login', 'FacebookCrawlersController.checkLogin').as('facebook.check-login');
Route.post('/facebook/groups/post', 'FacebookCrawlersController.post').as('facebook.post');
