import { test, expect } from '@playwright/test';
test.use({ colorScheme: 'light' });
test.beforeEach(async ({page}) => { await page.goto('/'); await page.getByRole('button',{name:'Esplora la demo'}).click(); });

test('navigazione semplificata, aggiungi al centro e indietro solo negli altri profili', async ({page}, info) => {
  const nav=page.locator(info.project.name==='mobile'?'.mobile-nav':'.desktop-nav');
  expect(await nav.getByRole('button').allTextContents()).toEqual(info.project.name==='mobile'?['Classifica','Aggiungi','Partite']:[' Classifica',' Partite']);
  await expect(page.locator('.club-footer')).toHaveCount(0);
  if(info.project.name==='mobile') {
    const box=await nav.boundingBox(), add=await nav.getByRole('button',{name:'Aggiungi',exact:true}).boundingBox();
    expect(Math.abs(add!.x+add!.width/2-(box!.x+box!.width/2))).toBeLessThan(2);
  }
  await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();
  await expect(page.getByRole('button',{name:'Torna al club'})).toHaveCount(0);
  await page.getByRole('button',{name:'Fuoricampo, vai alla classifica'}).click();
  await page.getByRole('searchbox',{name:'Cerca nella classifica'}).fill('Sara');
  await page.locator('.ranking-row').click();
  await expect(page.getByRole('button',{name:'Torna al club'})).toBeVisible();
  await page.getByRole('button',{name:'Torna al club'}).click();
  await expect(page.getByRole('heading',{name:'Chi comanda al tavolo?'})).toBeVisible();
});

test('banner persistente nel profilo e rifiuto di un nome già usato', async ({page}) => {
  await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();
  await page.getByRole('button',{name:'Modifica profilo'}).click();
  await page.getByRole('radio',{name:'Lavanda'}).check();
  await page.getByRole('textbox',{name:'Nome e cognome'}).fill('  gIULIA   rOSSI ');
  await page.getByRole('button',{name:'Salva il profilo'}).click();
  await expect(page.getByRole('alert')).toContainText('Questo nome è già utilizzato');
  await page.getByRole('textbox',{name:'Nome e cognome'}).fill('Diego Cogliati');
  await page.getByRole('button',{name:'Salva il profilo'}).click();
  await expect(page.locator('.profile-card .profile-cover')).toHaveAttribute('data-banner','lilac');
  await page.getByRole('button',{name:'Modifica profilo'}).click();
  await expect(page.getByRole('radio',{name:'Lavanda'})).toBeChecked();
});

test('tema di sistema, tema manuale persistente e corona sul campione', async ({page},info) => {
  await page.emulateMedia({colorScheme:'dark'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('button',{name:'Più forti',exact:true}).click();
  await page.locator('.ranking-row').first().click();
  await expect(page.getByRole('img',{name:'Primo in classifica',exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/profilo-dark-${info.project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Attiva tema chiaro'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('button',{name:'Attiva tema scuro'}).click();
  await expect.poll(() => page.evaluate(() => {
    const rgb=(s:string)=>s.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
    const lum=(v:number[])=>.2126*v[0]+.7152*v[1]+.0722*v[2];
    return Math.min(...['.auth-form-wrap .secondary','.auth-tabs .selected','.auth-form-wrap .primary'].map(selector=>{
      const s=getComputedStyle(document.querySelector(selector)!);const a=lum(rgb(s.color)),b=lum(rgb(s.backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    }));
  })).toBeGreaterThan(4.5);
  await page.screenshot({path:`test-results/accesso-dark-${info.project.name}.png`,fullPage:true});
  const contrast=await page.evaluate(() => {
    const rgb=(s:string)=>s.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
    const luminance=(v:number[])=>.2126*v[0]+.7152*v[1]+.0722*v[2];
    const root=getComputedStyle(document.documentElement),text=luminance(rgb(root.color)),bg=luminance(rgb(root.backgroundColor));
    return (Math.max(text,bg)+.05)/(Math.min(text,bg)+.05);
  });
  expect(contrast).toBeGreaterThan(4.5);
});

test('icone browser e home screen disponibili con le dimensioni corrette', async ({page}) => {
  const apple=await page.request.get('/apple-touch-icon.png');expect(apple.ok()).toBe(true);
  const png=await apple.body();expect(png.readUInt32BE(16)).toBe(180);expect(png.readUInt32BE(20)).toBe(180);
  const manifest=await (await page.request.get('/site.webmanifest')).json();
  for(const icon of manifest.icons){const response=await page.request.get(icon.src);expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/png');}
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href','/apple-touch-icon.png');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href','/site.webmanifest');
});

test('registrazione mostra errori chiari per nome ed email duplicati senza creare account', async ({page}) => {
  await page.getByRole('button',{name:'Esci dalla demo'}).click();
  await page.getByRole('button',{name:'Registrati',exact:true}).click();
  await page.getByRole('textbox',{name:'Nome e cognome'}).fill('Diego Cogliati');
  await page.getByRole('textbox',{name:'Email',exact:true}).fill('test@example.invalid');
  await page.locator('input[autocomplete="new-password"]').fill('OnlyForUiTests123');
  let available=false;
  await page.route('**/rest/v1/rpc/is_player_name_available',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(available)}));
  await page.route('**/auth/v1/signup**',r=>r.fulfill({status:422,contentType:'application/json',body:JSON.stringify({code:'user_already_exists',msg:'User already registered'})}));
  await page.getByRole('button',{name:'Crea il tuo account',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Questo nome è già utilizzato');
  available=true;
  await page.getByRole('button',{name:'Crea il tuo account',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Questa email è già registrata');
});
