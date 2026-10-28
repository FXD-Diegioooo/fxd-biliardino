import { test, expect } from '@playwright/test';
import { mockAccount } from './helpers/account';
import type { Match } from '../../src/lib/domain';

test('ricalcolo dello storico: quattro partite in valutazione, cinque sbloccano forza e podio',async({page},info)=>{
  const mock=await mockAccount(page);
  const me='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const match=(n:number):Match=>({id:`match-${n}`,created_at:new Date(Date.now()-(6-n)*60000).toISOString(),added_by:me,red_score:10,blue_score:4,mvp_id:n===2?me:null,participants:[{player_id:me,side:'red',role:'single'},{player_id:other,side:'blue',role:'single'}]});
  mock.state.matches=[4,3,2,1].map(match);
  await mock.login();await page.getByRole('button',{name:'Più forti',exact:true}).click();
  await expect(page.locator('.ranking-row.is-me')).toContainText('In valutazione');
  await expect(page.locator('.ranking-row.is-me')).toContainText('4/5 partite');
  await expect(page.locator('.podium-player')).toHaveCount(0);
  const cell=await page.locator('.ranking-row.is-me .rank-value').boundingBox(),arrow=await page.locator('.ranking-row.is-me>svg').boundingBox();
  expect(cell!.x+cell!.width).toBeLessThan(arrow!.x);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/forza-valutazione-${info.project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();
  await expect(page.locator('.career-summary')).toContainText('In valutazione');
  mock.state.matches.unshift(match(5));
  await page.reload();await page.getByRole('button',{name:'Più forti',exact:true}).click();
  await expect(page.locator('.ranking-row.is-me .rank-number')).toHaveText('01');
  await expect(page.locator('.ranking-row.is-me .rank-value')).not.toContainText('In valutazione');
  const score=Number((await page.locator('.ranking-row.is-me .rank-value').innerText()).replace(/\./g,'').replace(',','.'));
  expect(score).toBeGreaterThan(1016);
  await expect(page.locator('.podium-player')).toHaveCount(2);
  await page.getByRole('button',{name:'Le regole'}).click();
  await expect(page.getByRole('dialog')).toContainText('Servono 5 partite');
  await expect(page.getByRole('dialog')).not.toContainText('Wilson');
  await page.getByRole('button',{name:'Chiudi',exact:true}).click();
  await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();
  await expect(page.locator('.career-summary')).not.toContainText('In valutazione');
});

test('preferenza congelata nella partita e forza invariata dopo il cambio nel profilo',async({page},info)=>{
  await page.goto('/');await page.getByRole('button',{name:'Esplora la demo'}).click();
  const add=info.project.name==='mobile'?page.locator('.mobile-nav').getByRole('button',{name:'Aggiungi',exact:true}):page.getByRole('button',{name:'Aggiungi partita',exact:true}).first();
  await add.click();const dialog=page.getByRole('dialog');
  for(const name of ['Marco Bianchi','Diego Cogliati','Luca Colombo','Alessandro Riva']){
    await dialog.getByRole('combobox').first().fill(name);await dialog.getByRole('option',{name,exact:true}).click();
  }
  await dialog.getByRole('combobox',{name:'MVP della partita'}).selectOption('diego');
  await dialog.getByRole('button',{name:'Aggiungi la partita'}).click();await expect(dialog).not.toBeVisible();
  await page.locator('.recent-section .match-card').first().click();
  await expect(page.getByRole('dialog').locator('.person-line').filter({hasText:'Diego Cogliati'})).toContainText('Portiere · preferenza: Attaccante');
  await page.getByRole('button',{name:'Chiudi',exact:true}).click();
  await page.getByRole('button',{name:'Il mio profilo',exact:true}).click();
  const score=page.locator('.career-summary>div').first().locator('strong');const before=await score.innerText();
  await page.getByRole('button',{name:'Modifica profilo'}).click();
  await page.getByRole('button',{name:'Portiere',exact:true}).click();
  await page.getByRole('button',{name:'Salva il profilo'}).click();
  await expect(page.locator('.profile-card .pill')).toHaveText('Portiere');await expect(score).toHaveText(before);
});
