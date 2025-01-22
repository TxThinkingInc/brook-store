import crypto from 'node:crypto';
import lib from './lib/lib.js'

var migration = function(sqlite) {
    var m = lib.migrate(sqlite)
    m('create user table', `
create table user(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid text not null UNIQUE,
    username text not null UNIQUE,
    password text not null,
    expired_at INTEGER not null,
    traffic_max INTEGER not null,
    traffic_now INTEGER not null,
    created_at INTEGER not null 
)
`)
    m('create brook table', `
create table brook(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link text not null UNIQUE,
    created_at INTEGER not null 
)
`)
    m('create task table', `
create table task(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server text not null,
    user text not null,
    password text not null,
    sshkey text not null,
    serverlog_path text not null,
    pid_path text not null,
    created_at INTEGER not null 
)
`)
    m('create setting table', `
create table setting(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    k text not null UNIQUE,
    v text not null
)
`)
    var uuid = crypto.randomUUID().replaceAll('-', '')
    m('init user api path setting', `
insert into setting(k, v) values('user_api_path', '${uuid}')
`)
    m('init adminuser setting', `
insert into setting(k, v) values('adminuser', 'brook')
`)
    m('init adminpassword setting', `
insert into setting(k, v) values('adminpassword', 'brook')
`)
    m('init site name setting', `
insert into setting(k, v) values('site_name', 'Site Name')
`)
    m('init signup setting', `
insert into setting(k, v) values('signup', 'true')
`)
    m('init contact setting', `
insert into setting(k, v) values('contact', 'https://t.me/xxx')
`)
    m('init hidden import for browser setting', `
insert into setting(k, v) values('import_dislike_browser', 'false')
`)
    m('init site description setting', `
insert into setting(k, v) values('site_description', 'Site Description')
`)
    m('init reCAPTCHAKey setting', `
insert into setting(k, v) values('reCAPTCHAKey', '')
`)
    m('init reCAPTCHASecret setting', `
insert into setting(k, v) values('reCAPTCHASecret', '')
`)
    m('create product table', `
create table product(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name text not null,
    pay_url text not null
)
`)
    m('init product 1', `
insert into product(name, pay_url) values('$3.5 for month (100G/month)', 'https://www.your-pay-url.com')
`)
    m('init product 2', `
insert into product(name, pay_url) values('$30 for year (100G/month)', 'https://www.your-pay-url.com')
`)
}
export default migration;
