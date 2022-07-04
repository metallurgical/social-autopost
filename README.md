## Introduction

Auto post (facebook, more comings for other socials networks) using Pupetter headless browser and AdonisJS(nodejs).

## Serve Http

node ace serve --watch

## Routes

1. Get list of groups member joined
```
POST /facebook/groups

{
    email: <fb-email>,
    password: <fb-password>,
}
```

2. Auto post to groups
```
POST /facebook/groups/post

{
    email: <fb-email>,
    password: <fb-password>,
    message: 'Hello friend',
    groups: [{
        link: '',
    }], // Get from (1) array of groups's info like name, link, etc,
    images: [], // Path to the files to upload
}
```


