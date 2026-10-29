import { test, expect } from '@playwright/test';
import { mockAccount } from './helpers/account';

test('proposta dalla home: alternativa, precompilazione e salvataggio esplicito da 0–0',async({page},info)=>{
  await page.goto('/');await page.getByRole('button',{name:'Esplora la demo'}).click();
  const before=await page.locator('.ranking-row.is-me .rank-value').innerText();
  await page.getByRole('button',{name:'Suggerisci una partita'}).click();
  let dialog=page.getByRole('dialog');const first=await dialog.locator('.suggestion-intro h3').innerText();
  await expect(dialog.locator('.suggested-person')).toHaveCount(4);
  await dialog.getByRole('button',{name:'Altra proposta'}).click();
  await expect(dialog.locator('.suggestion-intro h3')).not.toHaveText(first);
  await page.screenshot({path:`test-results/proposta-${info.project.name}.png`,fullPage:true});
  await dialog.getByRole('button',{name:'Usa questa proposta'}).click();dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('heading',{name:'Una nuova sfida.'})).toBeVisible();
  await expect(dialog.locator('.picked-player')).toHaveCount(4);
  const names=await dialog.locator('.picked-player strong').allTextContents();expect(new Set(names).size).toBe(4);expect(names).toContain('Diego Cogliati');expect(names).not.toContain('Ospite');
  await expect(dialog.getByRole('spinbutton',{name:'Gol Rossi'})).toHaveValue('0');await expect(dialog.getByRole('spinbutton',{name:'Gol Blu'})).toHaveValue('0');
  await expect(page.locator('.ranking-row.is-me .rank-value')).toHaveText(before);
  await dialog.getByRole('button',{name:'Aggiungi la partita',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Niente pareggi');
  await dialog.getByRole('spinbutton',{name:'Gol Rossi'}).fill('10');await dialog.getByRole('spinbutton',{name:'Gol Blu'}).fill('7');
  await dialog.getByRole('button',{name:'Aggiungi la partita',exact:true}).click();await expect(dialog).not.toBeVisible();
  const number=(s:string)=>Number(s.replace(/[^\d]/g,''));expect(number(await page.locator('.ranking-row.is-me .rank-value').innerText())).toBe(number(before)+10);
  await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();await expect(page.locator('.profile-connections .companion-card')).toHaveCount(2);await expect(page.locator('.nemesis-card')).toContainText('ACERRIMO NEMICO');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/relazioni-${info.project.name}.png`,fullPage:true});
});

test('acerrimo nemico dallo storico e proposta singola con due utenti',async({page})=>{
  const mock=await mockAccount(page);const me='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  mock.state.matches=[{id:'loss',created_at:new Date().toISOString(),added_by:me,red_score:3,blue_score:10,mvp_id:null,participants:[{player_id:me,side:'red',role:'single'},{player_id:other,side:'blue',role:'single'}]}];
  await mock.login();await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();
  await expect(page.locator('.nemesis-card')).toContainText('Altro Giocatore');await expect(page.locator('.nemesis-card')).toContainText('1 sconfitta in 1 incontro');
  await page.getByRole('button',{name:'Fuoricampo, vai alla classifica'}).click();await page.getByRole('button',{name:'Suggerisci una partita'}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.locator('.suggested-person')).toHaveCount(2);await expect(dialog).toContainText('UN SINGOLO DA PROVARE');
  await dialog.getByRole('button',{name:'Usa questa proposta'}).click();await expect(page.getByRole('dialog').locator('.picked-player')).toHaveCount(2);
  await expect(page.getByRole('dialog').getByRole('button',{name:'1 contro 1'})).toHaveClass(/selected/);
  expect(mock.state.updates).toHaveLength(0);
});

test('nessuna partita inventata quando manca un altro iscritto',async({page})=>{
  const mock=await mockAccount(page);
  await page.route('**/rest/v1/profiles?*',async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth_user_id:mock.state.user.id,full_name:'Diego Test',preferred_role:'both',avatar_path:null,banner_color:'blue'}])}));
  await mock.login();await page.getByRole('button',{name:'Suggerisci una partita'}).click();
  await expect(page.getByRole('dialog')).toContainText('Serve almeno un altro giocatore');await expect(page.getByRole('button',{name:'Usa questa proposta'})).toHaveCount(0);
});
