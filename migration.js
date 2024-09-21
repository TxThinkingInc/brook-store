import migrate from './lib/migrate'

var migration = function(sqlite) {
    var m = migrate(sqlite)
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
    m('init blockDomainList setting', `
insert into setting(k, v) values('blockDomainList', '360.com\n360.cn\nspeedtest.net\nspeedtest.cn\nfast.com\ntest.ustc.edu.cn\nspeed.neu.edu.cn\ntest6.ustc.edu.cn\nspeed.cloudflare.com\nspeed4.neu6.edu.cn\nspeedtest.ecnu.edu.cn\nspeed5.ntu.edu.tw\nspeed.net.virginia.edu\nspeedtest.tp.edu.tw\nspeedtest.jh.edu')
`)
    m('init blockCIDR4List setting', `
insert into setting(k, v) values('blockCIDR4List', '127.0.0.1/32\n1.2.4.8/32')
`)
    m('init blockCIDR6List setting', `
insert into setting(k, v) values('blockCIDR6List', '::1/128\nfd00::/8')
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
}
export default migration;
