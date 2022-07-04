import Route from "@ioc:Adonis/Core/Route";

Route.get('/facebook/groups', 'FacebookCrawlersController.groups').as('facebook.groups');
Route.get('/facebook/groups/post', 'FacebookCrawlersController.post').as('facebook.post');
