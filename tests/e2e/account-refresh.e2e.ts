import { test, expect } from '@playwright/test';
import { mockAccount } from './helpers/account';

async function pull(page: import('@playwright/test').Page, distance=230, sideways=0, finish=true, selector='.page-heading'){
  return page.evaluate(({distance,sideways,finish,selector})=>{
    const target=document.querySelector(selector)||document.body;
    const touch=(x:number,y:number)=>new Touch({identifier:7,target,clientX:x,clientY:y,pageX:x,pageY:y+scrollY});
    const start=touch(100,120),end=touch(100+sideways,120+distance);
    target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[start],targetTouches:[start],changedTouches:[start]}));
    const move=new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[end],targetTouches:[end],changedTouches:[end]});target.dispatchEvent(move);
    if(finish)target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],targetTouches:[],changedTouches:[end]}));
    return move.defaultPrevented;
  },{distance,sideways,finish,selector});
}

test('credenziali: conferma finale, annullamento, password attuale e email in attesa',async({page},info)=>{
  const mock=await mockAccount(page);await mock.login();
  await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();
  await page.getByRole('button',{name:'Modifica email e password'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Nuova email',{exact:true}).fill('new@example.test');
  await expect(dialog.getByLabel('Nuova password',{exact:true})).toHaveCount(0);
  await dialog.getByLabel('Password attuale',{exact:true}).fill('WrongPassword');
  await dialog.getByRole('button',{name:'Conferma modifiche'}).click();
  await expect(dialog.getByRole('heading',{name:'Vuoi davvero aggiornare le credenziali?'})).toBeVisible();
  expect(mock.state.updates).toHaveLength(0);
  await dialog.getByRole('button',{name:'Torna indietro'}).click();
  expect(mock.state.updates).toHaveLength(0);
  await dialog.getByRole('button',{name:'Conferma modifiche'}).click();
  await dialog.getByRole('button',{name:'Sì, aggiorna credenziali'}).click();
  await expect(dialog.getByRole('alert')).toContainText('password attuale non è corretta');
  expect(mock.state.updates).toHaveLength(0);
  await dialog.getByRole('button',{name:'Torna indietro'}).click();
  await dialog.getByLabel('Password attuale',{exact:true}).fill('CurrentPassword123!');
  await dialog.getByRole('button',{name:'Conferma modifiche'}).click();
  await dialog.getByRole('button',{name:'Sì, aggiorna credenziali'}).click();
  await expect(dialog.getByRole('heading',{name:'Modifiche registrate.'})).toBeVisible();
  await expect(dialog).toContainText('in attesa di conferma');await expect(dialog).not.toContainText('password è stata aggiornata');
  expect(mock.state.updates).toHaveLength(1);expect(mock.state.updates[0]).toMatchObject({email:'new@example.test'});expect(mock.state.updates[0]).not.toHaveProperty('password');
  expect(mock.state.user.email).toBe('diego@example.test');
  await page.screenshot({path:`test-results/account-success-${info.project.name}.png`,fullPage:true});
});

test('credenziali: password nuove discordanti e aggiornamento della sola password',async({page})=>{
  const mock=await mockAccount(page);await mock.login();
  await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();await page.getByRole('button',{name:'Modifica email e password'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Nuova email',{exact:true}).fill('discarded@example.test');
  await dialog.getByRole('radio',{name:'Password',exact:true}).check();
  await expect(dialog.getByLabel('Nuova email',{exact:true})).toHaveCount(0);
  await dialog.getByLabel('Nuova password',{exact:true}).fill('NewPassword123!');await dialog.getByLabel('Conferma nuova password',{exact:true}).fill('DifferentPassword');await dialog.getByLabel('Password attuale',{exact:true}).fill(mock.state.password);
  await dialog.getByRole('button',{name:'Conferma modifiche'}).click();await expect(dialog.getByRole('alert')).toContainText('non coincidono');expect(mock.state.updates).toHaveLength(0);
  await dialog.getByLabel('Conferma nuova password',{exact:true}).fill('NewPassword123!');await dialog.getByRole('button',{name:'Conferma modifiche'}).click();await dialog.getByRole('button',{name:'Sì, aggiorna credenziali'}).click();
  await expect(dialog).toContainText('password è stata aggiornata');expect(mock.state.updates[0]).not.toHaveProperty('email');
});

test('correzione email fittizia conserva il profilo e richiede password e verifica nuova email',async({page})=>{
  const mock=await mockAccount(page);await mock.login();const playerId=mock.state.user.id;
  await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();
  await page.getByRole('button',{name:'Modifica email e password'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('radio',{name:'Password',exact:true}).check();
  await dialog.getByLabel('Nuova password',{exact:true}).fill('DiscardedPassword123!');
  await dialog.getByRole('button',{name:'Hai usato un’email fittizia? Correggila'}).click();
  await expect(dialog.getByRole('heading',{name:'Correggi la tua email.'})).toBeVisible();
  await expect(dialog).toContainText('Mantieni lo stesso profilo');
  await expect(dialog.getByLabel('Nuova email',{exact:true})).toHaveValue('');
  await expect(dialog.getByLabel('Nuova password',{exact:true})).toHaveCount(0);
  await dialog.getByLabel('Nuova email',{exact:true}).fill('real@example.test');
  await dialog.getByLabel('Password attuale',{exact:true}).fill(mock.state.password);
  await dialog.getByRole('button',{name:'Conferma modifiche'}).click();expect(mock.state.updates).toHaveLength(0);
  await dialog.getByRole('button',{name:'Sì, aggiorna credenziali'}).click();
  await expect(dialog).toContainText('in attesa di conferma');
  expect(mock.state.updates).toHaveLength(1);expect(mock.state.updates[0]).toMatchObject({email:'real@example.test'});
  expect(mock.state.updates[0]).not.toHaveProperty('password');expect(mock.state.user.id).toBe(playerId);
});

test('email confermata: aggiorna i dati Auth al rientro e rimuove gli avvisi obsoleti',async({page})=>{
  const mock=await mockAccount(page);mock.state.user.new_email='new@example.test';await mock.login();
  await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();
  await page.getByRole('button',{name:'Modifica email e password'}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Hai un cambio email in attesa di conferma');
  // The email link was confirmed in another tab, while this tab retains its session.
  mock.state.user.email='new@example.test';mock.state.user.new_email=undefined;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(dialog).not.toContainText('Hai un cambio email in attesa');
  await expect(dialog.getByLabel('Nuova email',{exact:true})).toHaveValue('new@example.test');
  // Ignore new_email if the service retains the address that is already active.
  mock.state.user.new_email='NEW@example.test';
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(dialog).not.toContainText('Hai un cambio email in attesa');
});

test('recupero password: richiesta email senza rivelare se un account esiste',async({page})=>{
  const mock=await mockAccount(page);await page.goto('/');await page.getByRole('button',{name:'Password dimenticata?'}).click();await page.getByLabel('Email',{exact:true}).fill('Absent@Example.Test');await page.getByRole('button',{name:'Invia link di recupero'}).click();
  await expect(page.getByRole('status')).toContainText('Se l’indirizzo è registrato');
  expect(mock.state.recoveries).toEqual([{email:'absent@example.test',redirect:'http://127.0.0.1:4173/?recovery=1'}]);
  expect(mock.state.updates).toHaveLength(0);
});

test('recupero password: link valido, conferma della nuova password e link scaduto',async({page})=>{
  const mock=await mockAccount(page);await page.goto(mock.recoveryPath());
  await expect(page.getByRole('heading',{name:'Nuova password.',exact:true})).toBeVisible();
  await page.getByLabel('Nuova password',{exact:true}).fill('RecoveredPassword123!');await page.getByLabel('Conferma nuova password',{exact:true}).fill('WrongRepeatedPassword');await page.getByRole('button',{name:'Salva password'}).click();await expect(page.getByRole('alert')).toContainText('non coincidono');expect(mock.state.updates).toHaveLength(0);
  await page.getByLabel('Conferma nuova password',{exact:true}).fill('RecoveredPassword123!');await page.getByRole('button',{name:'Salva password'}).click();
  await expect(page.getByRole('heading',{name:'Chi comanda al tavolo?'})).toBeVisible();expect(mock.state.updates).toHaveLength(1);expect(mock.state.updates[0]).toMatchObject({password:'RecoveredPassword123!'});
  await page.getByRole('button',{name:'Esci dal tuo account'}).click();await page.goto('/?recovery=1#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByRole('heading',{name:'Richiedi un nuovo link.'})).toBeVisible();await expect(page.getByRole('button',{name:'Salva password'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Invia link di recupero'})).toBeVisible();
});

test('tira per aggiornare ricarica i dati su ogni pagina mobile ed è disattivato su desktop',async({page},info)=>{
  const mock=await mockAccount(page);await mock.login();
  if(info.project.name==='desktop'){
    expect(await pull(page)).toBe(false);await expect(page.locator('html')).not.toHaveClass(/pull-refresh-enabled/);await expect(page.locator('.pull-refresh-indicator')).toHaveAttribute('aria-hidden','true');return;
  }
  await expect(page.locator('html')).toHaveClass(/pull-refresh-enabled/);
  for(const view of ['ranking','matches','profile']){
    if(view==='matches')await page.locator('.mobile-nav').getByRole('button',{name:'Partite',exact:true}).click();
    if(view==='profile')await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));const before=mock.state.profileReads;
    const loaded=page.waitForEvent('load');expect(await pull(page)).toBe(true);
    await expect(page.locator('.pull-refresh-indicator')).toHaveAttribute('data-state','refreshing');await loaded;
    await expect(page.getByRole('heading',{name:'Chi comanda al tavolo?'})).toBeVisible();expect(mock.state.profileReads).toBeGreaterThan(before);
  }
  await page.getByRole('button',{name:'Esci dal tuo account'}).click();const loaded=page.waitForEvent('load');await pull(page,230,0,true,'.auth-story');await loaded;await expect(page.getByRole('heading',{name:'Pronto a giocare?'})).toBeVisible();
});

test('tira per aggiornare ignora popup, gesti brevi o orizzontali e scorrimento lontano dall’inizio',async({page},info)=>{
  test.skip(info.project.name!=='mobile','I gesti sono disponibili solo sui dispositivi touch mobili.');
  const mock=await mockAccount(page);await mock.login();const before=mock.state.profileReads;
  await pull(page,60);await expect(page.locator('.pull-refresh-indicator')).toHaveAttribute('aria-hidden','true');
  expect(await pull(page,40,160)).toBe(false);
  await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();await page.evaluate(()=>scrollTo({top:200,behavior:'instant'}));expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(1);expect(await pull(page)).toBe(false);
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.getByRole('button',{name:'Modifica profilo'}).click();expect(await pull(page,240,0,true,'dialog .modal-head')).toBe(false);await expect(page.getByRole('dialog')).toBeVisible();expect(mock.state.profileReads).toBe(before);
  await page.getByRole('button',{name:'Chiudi',exact:true}).click();
  await pull(page,230,0,false);await expect(page.locator('.pull-refresh-indicator')).toHaveAttribute('data-state','ready');
  await page.evaluate(()=>document.body.dispatchEvent(new TouchEvent('touchcancel',{bubbles:true,touches:[],changedTouches:[]})));await expect(page.locator('.pull-refresh-indicator')).toHaveAttribute('aria-hidden','true');
  await pull(page,230,0,false);
  await page.evaluate(()=>{const target=document.querySelector('.page-heading')!;const touch=new Touch({identifier:7,target,clientX:100,clientY:122});target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[touch],changedTouches:[touch]}));target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[touch]}));});
  await expect(page.locator('.pull-refresh-indicator')).toHaveAttribute('aria-hidden','true');
});
