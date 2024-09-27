import os from 'node:os';
import migration from './migration'
import * as fs from 'node:fs/promises';
import lib from './lib/lib.js'
import crypto from 'node:crypto';
import html from './html.bundle.js';
import worker from './worker.bundle.js';

var db = lib.sqlite(os.homedir() + "/.brook.db", { wal: true })
migration(db)

lib.go(new TextDecoder().decode(worker("worker/task.worker.js")), null)

var user_api_path = db.query("select * from setting where k='user_api_path'").get().v
var index_html = new TextDecoder().decode(html("html/index.html"))
var hash = crypto.createHash('md5');
hash.update(index_html);
var index_html_etag = hash.digest('hex')
var admin_html = new TextDecoder().decode(html("html/admin.html"))
var hash = crypto.createHash('md5');
hash.update(admin_html);
var admin_html_etag = hash.digest('hex')

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
    development: process.env.dev ? true : false,
    port: process.env.dev ? 8080 : 24402,
    hostname: '127.0.0.1',
    async fetch(req, server) {
        try {
            var p = new URL(req.url).pathname;
            var q = (k) => new URL(req.url).searchParams.get(k) ? new URL(req.url).searchParams.get(k).trim() : '';

            // html
            if (p == "/") {
                if (!process.env.dev) {
                    if (req.headers.get('If-None-Match') == index_html_etag) {
                        return new Response(null, { status: 304 })
                    }
                }
                var s = index_html
                if (process.env.dev) {
                    s = await fs.readFile("html/index.html", { encoding: 'utf8' })
                }
                return new Response(s, {
                    status: 200,
                    headers: new Headers({
                        "ETag": index_html_etag,
                        "Content-Type": "text/html; charset=uff-8",
                    }),
                })
            }
            if (p == "/admin" || p == "/admin/") {
                var r = basicauth(req); if (r) return r
                if (!process.env.dev) {
                    if (req.headers.get('If-None-Match') == admin_html_etag) {
                        return new Response(null, { status: 304 })
                    }
                }
                var s = admin_html
                if (process.env.dev) {
                    s = await fs.readFile("html/admin.html", { encoding: 'utf8' })
                }
                return new Response(s, {
                    status: 200,
                    headers: new Headers({
                        "ETag": admin_html_etag,
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
                if (r.expired_at < lib.now()) {
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
                var hash = crypto.createHash('sha256');
                hash.update(j.password.trim());
                var password = hash.digest('hex')
                var r = db.c('user', {
                    uuid: crypto.randomUUID().replaceAll('-', ''),
                    username: j.username.trim().toLowerCase(),
                    password: password,
                    expired_at: j.expired_at,
                    traffic_max: j.traffic_max,
                    traffic_now: 0,
                    created_at: lib.now(),
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
                    var hash = crypto.createHash('sha256');
                    hash.update(j.password.trim());
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
                var l = db.query(`select * from user order by id desc`).all()
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
                    created_at: lib.now(),
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
                var l = db.query(`select * from brook order by id desc`).all()
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
                    created_at: lib.now(),
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
                var l = db.query(`select * from task order by id desc`).all()
                return new Response(JSON.stringify(l), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/addproduct") {
                var r = basicauth(req); if (r) return r
                var j = await req.json()
                var r = db.c('product', {
                    name: j.name,
                    pay_url: j.pay_url,
                })
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/updateproduct") {
                var r = basicauth(req); if (r) return r
                var j = await req.json()
                var r = db.u('product', {
                    id: j.id,
                    name: j.name,
                    pay_url: j.pay_url,
                })
                return new Response(JSON.stringify(r), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/removeproduct") {
                var r = basicauth(req); if (r) return r
                var j = await req.json()
                db.d('product', j.id)
                return Response()
            }
            if (p == "/getproducts") {
                var r = basicauth(req); if (r) return r
                var l = db.query(`select * from product`).all()
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
            if (p == "/callback/" + user_api_path) {
                var r = db.query('select * from user where id=?').get(q('user_id'))
                if (!r) {
                    throw `invalid user_id`
                }
                if (r.traffic_max != parseInt(q('traffic_max')) || r.expired_at < lib.now()) {
                    r.expired_at = lib.now()
                }
                r.expired_at += parseInt(q('duration'))
                r.traffic_max = parseInt(q('traffic_max'))
                db.u('user', {
                    id: r.id,
                    expired_at: r.expired_at,
                    traffic_max: r.traffic_max,
                })
                return new Response()
            }

            // frontend
            if (p == "/signup") {
                await recaptchaauth(req)
                if (db.query('select * from setting where k="signup"').get().v != 'true') {
                    var s = db.query('select * from setting where k="contact"').get().v
                    throw `Please contact ${s} to open an account`
                }
                var j = await req.json()
                if (j.username.length > 30 || j.password.length > 30) {
                    throw 'username or password too long'
                }
                var r = db.query('select * from user where username=?').get(j.username.trim().toLowerCase())
                if (r) {
                    throw 'username exists, try another one'
                }
                var hash = crypto.createHash('sha256');
                hash.update(j.password.trim());
                var password = hash.digest('hex')
                var r = db.c('user', {
                    uuid: crypto.randomUUID().replaceAll('-', ''),
                    username: j.username.trim().toLowerCase(),
                    password: password,
                    expired_at: lib.now(),
                    traffic_max: 0,
                    traffic_now: 0,
                    created_at: lib.now(),
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
                var hash = crypto.createHash('sha256');
                hash.update(j.password.trim());
                var password = hash.digest('hex')
                var r = db.query(`select * from user where username=? and password=?`).get(j.username.trim().toLowerCase(), password)
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
            if (p == "/getsomesettings") {
                var l = db.query(`select * from setting`).all()
                l = l.filter(v => ['site_name', 'site_description', 'contact', 'reCAPTCHAKey'].indexOf(v.k) != -1)
                return new Response(JSON.stringify(l), {
                    status: 200,
                    headers: new Headers({
                        "Content-Type": "application/json",
                    }),
                })
            }
            if (p == "/getfeproducts") {
                var l = db.query(`select * from product`).all()
                return new Response(JSON.stringify(l), {
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
                if (j.password.length > 30) {
                    throw 'password too long'
                }
                var hash = crypto.createHash('sha256');
                hash.update(j.password.trim());
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
                if (u.expired_at < lib.now()) {
                    throw `expired user ${u.id}`
                }
                if (req.headers.get('User-Agent').indexOf('Go-http-client/') == -1 && req.headers.get('User-Agent').indexOf('Dart/') == -1) {
                    var s = db.query('select * from setting where k="import_dislike_browser"').get().v
                    if (s == 'true') {
                        throw 'You need Brook to import this link'
                    }
                }
                var l = db.query(`select * from brook order by id desc`).all()
                var s = l.map(v => {
                    var u = new URL(v.link)
                    u.searchParams.set("token", q('uuid'))
                    return u.toString()
                }).join("\n")
                return new Response(s)
            }
            return new Response(null, { status: 404 });
        } catch (e) {
            return new Response(e.toString(), { status: 400 });
        }
    },
});
