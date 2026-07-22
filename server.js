const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const PRODUCTS_FILE = path.join(DATA, 'products.json');
const ORDERS_FILE = path.join(DATA, 'orders.json');
const USERS_FILE = path.join(DATA, 'users.json');
const UPLOADS = path.join(ROOT, 'assets', 'uploads');
const PORT = Number(process.env.PORT || 8002);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const sessions = new Map();
const loginAttempts = new Map();
let writeQueue = Promise.resolve();

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });
const business = require('./business')(ROOT);
const hashPassword=(password,salt=crypto.randomBytes(16).toString('hex'))=>`${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`;
const verifyPassword=(password,stored)=>{try{const[salt,hash]=stored.split(':'),actual=crypto.scryptSync(password,salt,64),expected=Buffer.from(hash,'hex');return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected)}catch{return false}};
if(!fs.existsSync(USERS_FILE))fs.writeFileSync(USERS_FILE,JSON.stringify([{id:crypto.randomUUID(),username:'owner',name:'Johnson Zoglo',role:'owner',passwordHash:hashPassword(ADMIN_PASSWORD),active:true,createdAt:new Date().toISOString()}],null,2));

const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.ico':'image/x-icon' };
const readJson = (file, fallback=[]) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJson = (file, value) => {
  writeQueue = writeQueue.then(async () => {
    const temporary = `${file}.tmp`;
    await fs.promises.writeFile(temporary, JSON.stringify(value, null, 2));
    await fs.promises.rename(temporary, file);
  });
  return writeQueue;
};
const json = (res, status, body) => { const data=Buffer.from(JSON.stringify(body)); res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store'}); res.end(data); };
const body = (req, limit=8_000_000) => new Promise((resolve,reject) => { let size=0,chunks=[]; req.on('data',chunk=>{size+=chunk.length;if(size>limit){reject(new Error('Request too large'));req.destroy();}else chunks.push(chunk)}); req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString()||'{}'))}catch{reject(new Error('Invalid JSON'))}}); req.on('error',reject); });
const clean = (value, max=200) => String(value || '').trim().slice(0,max);
const money = value => Math.round(Number(value) * 100) / 100;
const authorized = req => { const token=(req.headers.authorization||'').replace('Bearer ',''); const session=sessions.get(token); return session && session.expiry>Date.now()?session:null; };

async function api(req,res,url) {
  if (req.method==='POST' && url.pathname==='/api/admin/login') {
    const ip=req.socket.remoteAddress||'local',attempt=loginAttempts.get(ip)||{count:0,until:0};if(attempt.count>=5&&attempt.until>Date.now())return json(res,429,{error:'Too many attempts. Try again in 15 minutes.'});
    const data=await body(req,10000),username=clean(data.username||'owner',50).toLowerCase(),user=readJson(USERS_FILE).find(item=>item.username===username&&item.active!==false);if(!user||!verifyPassword(clean(data.password,200),user.passwordHash)){loginAttempts.set(ip,{count:attempt.count+1,until:Date.now()+15*60*1000});return json(res,401,{error:'Incorrect username or password'});}loginAttempts.delete(ip);
    const token=crypto.randomBytes(24).toString('hex');sessions.set(token,{expiry:Date.now()+8*60*60*1000,user:{id:user.id,username:user.username,name:user.name,role:user.role}});business.audit('auth.login',user.username,user.username);return json(res,200,{token,expiresIn:28800,user:{name:user.name,username:user.username,role:user.role}});
  }
  if (req.method==='GET' && url.pathname==='/api/products') {
    return json(res,200,readJson(PRODUCTS_FILE).filter(product=>product.active!==false));
  }
  if (req.method==='GET' && url.pathname==='/api/store-settings') {
    const settings=business.read('settings',business.defaults); return json(res,200,{currency:settings.currency,taxRate:settings.taxRate,deliveryZones:settings.deliveryZones,contactEmail:settings.contactEmail,contactPhone:settings.contactPhone});
  }
  if (req.method==='POST' && url.pathname==='/api/orders') {
    const data=await body(req,200000); const customer=data.customer||{}; const requested=Array.isArray(data.items)?data.items:[];
    if(!clean(customer.name)||!clean(customer.email)||!clean(customer.phone)||!clean(customer.address)||!requested.length) return json(res,400,{error:'Complete your contact, delivery, and cart information.'});
    const products=readJson(PRODUCTS_FILE); const items=[];
    for(const request of requested){const product=products.find(item=>item.id===request.id&&item.active!==false);const quantity=Math.max(1,Math.min(10,Number(request.quantity)||1));if(!product)return json(res,400,{error:'A product in your cart is no longer available.'});if(product.stock<quantity)return json(res,409,{error:`Only ${product.stock} ${product.name} available.`});items.push({id:product.id,name:product.name,category:product.category,price:product.price,quantity,subtotal:money(product.price*quantity)});}
    items.forEach(item=>{products.find(product=>product.id===item.id).stock-=item.quantity});
    const orders=readJson(ORDERS_FILE); const pricing=business.price(items,data.discountCode,data.deliveryZone); const order={id:crypto.randomUUID(),number:`JZ-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(orders.length+1).padStart(4,'0')}`,createdAt:new Date().toISOString(),status:'new',paymentStatus:'pending',paymentMethod:['cash','bank'].includes(data.paymentMethod)?data.paymentMethod:'cash',customer:{name:clean(customer.name,100),email:clean(customer.email,150),phone:clean(customer.phone,40),address:clean(customer.address,500),note:clean(customer.note,500)},items,...pricing};
    orders.push(order); await writeJson(PRODUCTS_FILE,products); await writeJson(ORDERS_FILE,orders); business.audit('order.created',`${order.number} · ${order.customer.name} · $${order.total}`,'customer'); return json(res,201,{orderNumber:order.number,total:order.total,status:order.status});
  }
  if (!url.pathname.startsWith('/api/admin/')) return json(res,404,{error:'API route not found'});
  const session=authorized(req);if (!session) return json(res,401,{error:'Please sign in again.'});
  if (req.method==='GET' && url.pathname==='/api/admin/products') return json(res,200,readJson(PRODUCTS_FILE));
  if (req.method==='POST' && url.pathname==='/api/admin/products') {
    const data=await body(req,200000); if(!clean(data.name)||!clean(data.category)||!(Number(data.price)>=0))return json(res,400,{error:'Name, category, and valid price are required.'});
    const products=readJson(PRODUCTS_FILE); const product={id:`${clean(data.name,40).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${crypto.randomBytes(2).toString('hex')}`,...normalizeProduct(data)}; products.unshift(product); await writeJson(PRODUCTS_FILE,products); business.audit('product.created',product.name); return json(res,201,product);
  }
  const productMatch=url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if(productMatch && req.method==='PUT') { const data=await body(req,200000); const products=readJson(PRODUCTS_FILE); const index=products.findIndex(item=>item.id===decodeURIComponent(productMatch[1])); if(index<0)return json(res,404,{error:'Product not found'}); products[index]={...products[index],...normalizeProduct(data)}; await writeJson(PRODUCTS_FILE,products); business.audit('product.updated',products[index].name); return json(res,200,products[index]); }
  if(productMatch && req.method==='DELETE') { const products=readJson(PRODUCTS_FILE); const removed=products.find(item=>item.id===decodeURIComponent(productMatch[1])); const next=products.filter(item=>item.id!==decodeURIComponent(productMatch[1])); if(next.length===products.length)return json(res,404,{error:'Product not found'}); await writeJson(PRODUCTS_FILE,next); business.audit('product.deleted',removed.name); return json(res,200,{ok:true}); }
  if(req.method==='POST' && url.pathname==='/api/admin/upload') { const data=await body(req); const match=String(data.data||'').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/); if(!match)return json(res,400,{error:'Choose a PNG, JPEG, or WebP image.'}); const buffer=Buffer.from(match[2],'base64'); if(buffer.length>5_000_000)return json(res,413,{error:'Image must be smaller than 5MB.'}); const extension=match[1]==='image/jpeg'?'.jpg':`.${match[1].split('/')[1]}`; const name=`product-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${extension}`; await fs.promises.writeFile(path.join(UPLOADS,name),buffer); return json(res,201,{url:`assets/uploads/${name}`}); }
  if(req.method==='GET' && url.pathname==='/api/admin/orders') return json(res,200,readJson(ORDERS_FILE).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
  const orderMatch=url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if(orderMatch && req.method==='PATCH'){const data=await body(req,20000);const orders=readJson(ORDERS_FILE);const order=orders.find(item=>item.id===decodeURIComponent(orderMatch[1]));if(!order)return json(res,404,{error:'Order not found'});if(['new','confirmed','processing','ready','completed','cancelled'].includes(data.status))order.status=data.status;if(['pending','paid','refunded'].includes(data.paymentStatus))order.paymentStatus=data.paymentStatus;await writeJson(ORDERS_FILE,orders);business.audit('order.updated',`${order.number} · ${order.status} · ${order.paymentStatus}`);return json(res,200,order);}
  if(req.method==='GET'&&url.pathname==='/api/admin/customers')return json(res,200,business.customers(readJson(ORDERS_FILE)));
  if(req.method==='GET'&&url.pathname==='/api/admin/reports')return json(res,200,business.report(readJson(ORDERS_FILE),readJson(PRODUCTS_FILE)));
  if(req.method==='GET'&&url.pathname==='/api/admin/settings')return json(res,200,business.read('settings',business.defaults));
  if(req.method==='PUT'&&url.pathname==='/api/admin/settings'){const data=await body(req,100000);const settings={...business.defaults,...data,taxRate:Number(data.taxRate)||0,lowStockThreshold:Math.max(0,Number(data.lowStockThreshold)||0),deliveryZones:(data.deliveryZones||[]).map(z=>({id:clean(z.id,30),name:clean(z.name,80),fee:money(z.fee)}))};business.write('settings',settings);business.audit('settings.updated','Store settings changed');return json(res,200,settings);}
  if(req.method==='GET'&&url.pathname==='/api/admin/discounts')return json(res,200,business.read('discounts'));
  if(req.method==='POST'&&url.pathname==='/api/admin/discounts'){const data=await body(req,50000),discounts=business.read('discounts'),discount={id:crypto.randomUUID(),code:clean(data.code,30).toUpperCase(),type:data.type==='fixed'?'fixed':'percent',value:Math.max(0,Number(data.value)||0),expiresAt:clean(data.expiresAt,30),active:data.active!==false};if(!discount.code)return json(res,400,{error:'Discount code is required'});discounts.unshift(discount);business.write('discounts',discounts);business.audit('discount.created',discount.code);return json(res,201,discount);}
  const discountMatch=url.pathname.match(/^\/api\/admin\/discounts\/([^/]+)$/);if(discountMatch&&req.method==='DELETE'){const discounts=business.read('discounts'),next=discounts.filter(d=>d.id!==decodeURIComponent(discountMatch[1]));business.write('discounts',next);business.audit('discount.deleted',decodeURIComponent(discountMatch[1]));return json(res,200,{ok:true});}
  if(req.method==='GET'&&url.pathname==='/api/admin/audit')return json(res,200,business.read('audit'));
  if(req.method==='GET'&&url.pathname==='/api/admin/backup')return json(res,200,{...business.backup(readJson(PRODUCTS_FILE),readJson(ORDERS_FILE)),users:readJson(USERS_FILE)});
  if(req.method==='POST'&&url.pathname==='/api/admin/restore'){if(session.user.role!=='owner')return json(res,403,{error:'Owner access required'});const data=await body(req,10_000_000);if(!Array.isArray(data.products)||!Array.isArray(data.orders)||!data.settings)return json(res,400,{error:'Invalid backup file'});await writeJson(PRODUCTS_FILE,data.products);await writeJson(ORDERS_FILE,data.orders);if(Array.isArray(data.users)&&data.users.length)await writeJson(USERS_FILE,data.users);business.write('settings',data.settings);business.write('discounts',Array.isArray(data.discounts)?data.discounts:[]);business.write('audit',Array.isArray(data.audit)?data.audit:[]);business.audit('backup.restored',`Restored ${data.products.length} products and ${data.orders.length} orders`,session.user.username);return json(res,200,{ok:true});}
  if(req.method==='GET'&&url.pathname==='/api/admin/users'){if(session.user.role!=='owner')return json(res,403,{error:'Owner access required'});return json(res,200,readJson(USERS_FILE).map(({passwordHash,...user})=>user));}
  if(req.method==='POST'&&url.pathname==='/api/admin/users'){if(session.user.role!=='owner')return json(res,403,{error:'Owner access required'});const data=await body(req,50000),users=readJson(USERS_FILE),username=clean(data.username,50).toLowerCase();if(!username||clean(data.password,200).length<8)return json(res,400,{error:'Username and password of at least 8 characters are required'});if(users.some(u=>u.username===username))return json(res,409,{error:'Username already exists'});const user={id:crypto.randomUUID(),username,name:clean(data.name,100)||username,role:['owner','manager','staff'].includes(data.role)?data.role:'staff',passwordHash:hashPassword(data.password),active:true,createdAt:new Date().toISOString()};users.push(user);await writeJson(USERS_FILE,users);business.audit('user.created',`${user.username} · ${user.role}`,session.user.username);const{passwordHash,...safe}=user;return json(res,201,safe);}
  const userMatch=url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);if(userMatch&&req.method==='PATCH'){if(session.user.role!=='owner')return json(res,403,{error:'Owner access required'});const data=await body(req,50000),users=readJson(USERS_FILE),user=users.find(u=>u.id===decodeURIComponent(userMatch[1]));if(!user)return json(res,404,{error:'User not found'});if(data.password){if(String(data.password).length<8)return json(res,400,{error:'Password must be at least 8 characters'});user.passwordHash=hashPassword(data.password)}if(['owner','manager','staff'].includes(data.role))user.role=data.role;if(typeof data.active==='boolean')user.active=data.active;await writeJson(USERS_FILE,users);business.audit('user.updated',user.username,session.user.username);const{passwordHash,...safe}=user;return json(res,200,safe);}
  return json(res,404,{error:'Admin route not found'});
}

function normalizeProduct(data){return{name:clean(data.name,100),category:clean(data.category,30).toLowerCase(),price:money(data.price),stock:Math.max(0,Math.floor(Number(data.stock)||0)),condition:['new','used','refurbished'].includes(data.condition)?data.condition:'new',description:clean(data.description,500),image:clean(data.image,500),art:clean(data.art,40),active:data.active!==false};}

function serveStatic(req,res,url){let relative=decodeURIComponent(url.pathname);if(relative==='/')relative='/index.html';const file=path.resolve(ROOT,`.${relative}`);if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('404 - File not found');}const stat=fs.statSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);}

const server=http.createServer(async(req,res)=>{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);try{if(url.pathname.startsWith('/api/'))await api(req,res,url);else serveStatic(req,res,url);}catch(error){console.error(error);if(!res.headersSent)json(res,error.message==='Request too large'?413:500,{error:error.message||'Server error'});}});
server.listen(PORT,'127.0.0.1',()=>console.log(`JZ Commerce running at http://localhost:${PORT}`));
