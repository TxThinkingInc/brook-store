import os from 'node:os';
import sqlite from './lib/sqlite'
import migration from './migration'
import task from './task'
import bundled from './bundled.js';
import * as fs from 'node:fs/promises';
import lib from './lib/lib.js'
import crypto from 'node:crypto';

var db = sqlite(os.homedir() + "/.brook.db")
migration(db)
task(db)
var user_api_path = db.query("select * from setting where k='user_api_path'").get().v
var index_html = new TextDecoder().decode(bundled("static/index.html"))
var hash = crypto.createHash('md5');
hash.update(index_html);
var index_html_etag = hash.digest('hex')
var admin_html = new TextDecoder().decode(bundled("static/admin.html"))
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
                var html = index_html
                if (process.env.dev) {
                    html = await fs.readFile("static/index.html", { encoding: 'utf8' })
                }
                return new Response(html, {
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
                var html = admin_html
                if (process.env.dev) {
                    html = await fs.readFile("static/admin.html", { encoding: 'utf8' })
                }
                return new Response(html, {
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
                hash.update(j.password);
                var password = hash.digest('hex')
                var r = db.c('user', {
                    uuid: crypto.randomUUID().replaceAll('-', ''),
                    username: j.username,
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
                if (db.query('select * from setting where k="signup"').get().v != 'true') {
                    var s = db.query('select * from setting where k="contact"').get().v
                    throw `Please contact ${s} to open an account`
                }
                var j = await req.json()
                var hash = crypto.createHash('sha256');
                hash.update(j.password);
                var password = hash.digest('hex')
                var r = db.c('user', {
                    uuid: crypto.randomUUID().replaceAll('-', ''),
                    username: j.username,
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
                var j = await req.json()
                var hash = crypto.createHash('sha256');
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
            if (p == "/getsomesettings") {
                var l = db.query(`select * from setting`).all()
                l = l.filter(v => ['site_name', 'site_description', 'contact'].indexOf(v.k) != -1)
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
                var hash = crypto.createHash('sha256');
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
                if (u.expired_at < lib.now()) {
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
