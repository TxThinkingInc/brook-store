import _ from './lib/jb'
import os from 'node:os';
import sqlite from './lib/sqlite'
import migration from './migration'
import task from './task'
import readFileSync from './bundle.js';
import fs from 'node:fs';

var db = sqlite(os.homedir() + "/.brook.db")
migration(db)
task(db)
var user_api_path = db.query("select * from setting where k='user_api_path'").get().v

function static_file(s) {
    if (process.env.dev) {
        return fs.readFileSync(s);
    }
    return readFileSync(s)
}

function basicauth(req) {
    var s = req.headers.get("Authorization")
    var u = db.query('select * from setting where k="adminuser"').get().v
    var p = db.query('select * from setting where k="adminpassword"').get().v
    var s1 = `Basic ${btoa(u + ':' + p)}`
    if (s != s1) {
        return new Response("", {
            status: 401,
            headers: new Headers({
                "WWW-Authenticate": 'Basic realm="/"',
            }),
        })
    }
}

async function recaptchaauth(req) {
    var k = db.query('select * from setting where k="reCAPTCHAKey"').get().v
    var s = db.query('select * from setting where k="reCAPTCHASecret"').get().v
    if (k && s) {
        var r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ secret: s, response: new URL(req.url).searchParams.get('recaptcha_token') }).toString(),
        })
        if (!(await r.json()).success) {
            throw 'Are you bot?'
        }
    }
}

Bun.serve({
    development: false,
    port: 24402,
    hostname: '127.0.0.1',
    async fetch(req, server) {
        try {
            var p = new URL(req.url).pathname;
            var q = (k) => new URL(req.url).searchParams.get(k) ? new URL(req.url).searchParams.get(k).trim() : '';

            if (p == "/") {
                var html = new TextDecoder().decode(static_file("static/index.html"))
                var k = db.query('select * from setting where k="reCAPTCHAKey"').get().v
                var s = db.query('select * from setting where k="reCAPTCHASecret"').get().v
                if (k && s) {
                    html = html
                        .replace('<!--RECAPTCHA_HEAD-->', `<script src="https://www.recaptcha.net/recaptcha/api.js?render=${k}"></script>`)
                        .replace('<!--RECAPTCHA_KEY-->', k)
                }
                var site_name = db.query('select * from setting where k="site_name"').get().v
                html = html.replaceAll('SITE_NAME', site_name)
                return new Response(html, {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "text/html; charset=uff-8",
                    }),
                })
            }
            if (p == "/admin" || p == "/admin/") {
                var r = basicauth(req); if (r) return r
                var site_name = db.query('select * from setting where k="site_name"').get().v
                var html = new TextDecoder().decode(static_file("static/admin.html"))
                html = html.replaceAll('SITE_NAME', site_name)
                return new Response(html, {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "text/html; charset=uff-8",
                    }),
                })
            }
            // userAPI
            if (p == "/" + user_api_path) {
                var r = db.query('select * from user where uuid=?').get(q('token'))
                if (!r) {
                    throw `invalid token ${q('token')}`
                }
                if (r.expired_at < now()) {
                    throw `expired user ${r.id}`
                }
                if (r.traffic_now > r.traffic_max) {
                    throw `user ${r.id} has reached traffic_max`
                }
                return new Response(r.id)
            }
            if (p == "/blockDomainList") {
                var s = db.query('select * from setting where k="blockDomainList"').get().v
                return new Response(s)
            }
            if (p == "/blockCIDR4List") {
                var s = db.query('select * from setting where k="blockCIDR4List"').get().v
                return new Response(s)
            }
            if (p == "/blockCIDR6List") {
                var s = db.query('select * from setting where k="blockCIDR6List"').get().v
                return new Response(s)
            }
            // backend
            if (p == "/adduser") {
                var r = basicauth(req); if (r) return r
                var j = await req.json()
                var c = require('crypto');
                var hash = c.createHash('sha256');
                hash.update(j.password);
                var password = hash.digest('hex')
                var r = db.c('user', {
                    uuid: crypto.randomUUID().replaceAll('-', ''),
                    username: j.username,
                    password: password,
                    expired_at: j.expired_at,
                    traffic_max: j.traffic_max,
                    traffic_now: 0,
                    created_at: now(),
                })
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/updateuser") {
                var r = basicauth(req); if (r) return r
                var j = await req.json()
                var o = { id: j.id }
                if (j.password) {
                    var c = require('crypto');
                    var hash = c.createHash('sha256');
                    hash = c.createHash('sha256');
                    hash.update(j.password);
                    o.password = hash.digest('hex')
                }
                if (j.expired_at) {
                    o.expired_at = j.expired_at
                }
                if (j.traffic_max) {
                    o.traffic_max = j.traffic_max
                }
                var r = db.u('user', o)
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/getusers") {
                var r = basicauth(req); if (r) return r
                var l = db.query(`select * from user`).all()
                return new Response(JSON.stringify(l), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/addbrook") {
                var r = basicauth(req); if (r) return r
                var j = await req.json()
                var r = db.c('brook', {
                    link: j.link,
                    created_at: now(),
                })
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/removebrook") {
                var r = basicauth(req); if (r) return r
                var j = await req.json()
                db.d('brook', j.id)
                return Response()
            }
            if (p == "/getbrooks") {
                var r = basicauth(req); if (r) return r
                var l = db.query(`select * from brook`).all()
                return new Response(JSON.stringify(l), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/addtask") {
                var r = basicauth(req); if (r) return r
                var j = await req.json()
                var r = db.c('task', {
                    server: j.server,
                    user: j.user,
                    password: j.password,
                    sshkey: j.sshkey,
                    serverlog_path: j.serverlog_path,
                    pid_path: j.pid_path,
                    created_at: now(),
                })
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/removetask") {
                var r = basicauth(req); if (r) return r
                var j = await req.json()
                db.d('task', j.id)
                return Response()
            }
            if (p == "/gettasks") {
                var r = basicauth(req); if (r) return r
                var l = db.query(`select * from task`).all()
                return new Response(JSON.stringify(l), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/getsettings") {
                var r = basicauth(req); if (r) return r
                var l = db.query(`select * from setting`).all()
                return new Response(JSON.stringify(l), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/updatesetting") {
                var r = basicauth(req); if (r) return r
                var j = await req.json()
                var r = db.u('setting', {
                    id: j.id,
                    k: j.k,
                    v: j.v,
                })
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            // frontend
            if (p == "/signup") {
                await recaptchaauth(req)
                if (db.query('select * from setting where k="signup"').get().v != 'true') {
                    var s = db.query('select * from setting where k="contact"').get().v
                    throw `Please contact ${s} to open an account`
                }
                var j = await req.json()
                var c = require('crypto');
                var hash = c.createHash('sha256');
                hash.update(j.password);
                var password = hash.digest('hex')
                var r = db.c('user', {
                    uuid: crypto.randomUUID().replaceAll('-', ''),
                    username: j.username,
                    password: password,
                    expired_at: now(),
                    traffic_max: 0,
                    traffic_now: 0,
                    created_at: now(),
                })
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/signin") {
                await recaptchaauth(req)
                var j = await req.json()
                var c = require('crypto');
                var hash = c.createHash('sha256');
                hash.update(j.password);
                var password = hash.digest('hex')
                var r = db.query(`select * from user where username=? and password=?`).get(j.username, password)
                if (!r) {
                    throw 'username or password wrong'
                }
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/getuser") {
                var j = await req.json()
                var r = db.query(`select * from user where uuid=?`).get(j.uuid)
                if (!r) {
                    throw 'hacking'
                }
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/getcontact") {
                var r = db.query(`select * from setting where k='contact'`).get()
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/updatepassword") {
                var j = await req.json()
                var r = db.query(`select * from user where uuid=?`).get(j.uuid)
                if (!r) {
                    throw 'hacking'
                }
                var c = require('crypto');
                var hash = c.createHash('sha256');
                hash.update(j.password);
                var password = hash.digest('hex')
                var r = db.u('user', { id: r.id, password: password })
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/import") {
                var u = db.query(`select * from user where uuid=?`).get(q('uuid'))
                if (!u) {
                    throw 'invalid import link, try to contact your provider'
                }
                if (u.expired_at < now()) {
                    throw `expired user ${u.id}`
                }
                var s = db.query('select * from setting where k="import_dislike_browser"').get().v
                if (s == 'true') {
                    if (req.headers.get('User-Agent').indexOf('Go-http-client/') == -1 && req.headers.get('User-Agent').indexOf('Dart/') == -1) {
                        throw 'You need Brook to import this link'
                    }
                }
                var l = db.query(`select * from brook`).all()
                var s = l.map(v => {
                    var u = new URL(v.link)
                    u.searchParams.set("token", q('uuid'))
                    return u.toString()
                }).join("\n")
                return new Response(s)
            }
            throw 'hacking'
        } catch (e) {
            return new Response(e.toString(), { status: 400 });
        }
    },
});
