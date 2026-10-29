import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Esplora la demo'}).click();});
for (const scenario of [
  { name:'un ospite nel doppio', slots:['Diego Cogliati','Ospite','Marco Bianchi','Giulia Rossi'], guests:1 },
  { name:'un ospite per squadra', slots:['Diego Cogliati','Ospite','Marco Bianchi','Ospite'], guests:2 },
  { name:'due ospiti nella stessa squadra', slots:['Diego Cogliati','Giulia Rossi','Ospite','Ospite'], guests:2 },
  { name:'un ospite nel singolo', slots:['Diego Cogliati','Ospite'], guests:1 },
]) test(scenario.name,async({page},info)=>{
  const add=info.project.name==='mobile'?page.locator('.mobile-nav').getByRole('button',{name:'Aggiungi',exact:true}):page.getByRole('button',{name:'Aggiungi partita',exact:true}).first();
  await add.click();const dialog=page.getByRole('dialog');
  if(scenario.slots.length===2)await dialog.getByRole('button',{name:'1 contro 1'}).click();
  for(const name of scenario.slots){await dialog.getByRole('combobox').first().fill(name);await expect(dialog.getByRole('option',{name,exact:true})).toHaveCount(1);await dialog.getByRole('option',{name,exact:true}).click();}
  await expect(dialog.getByRole('combobox',{name:'MVP della partita'}).locator('option')).not.toContainText(['Ospite']);
  await dialog.getByRole('combobox',{name:'MVP della partita'}).selectOption('diego');
  await dialog.getByRole('spinbutton',{name:'Gol Rossi'}).fill('10');
  await dialog.getByRole('button',{name:'Aggiungi la partita'}).click();await expect(dialog).not.toBeVisible();
  await expect(page.locator('.ranking-row').filter({hasText:'Ospite'})).toHaveCount(0);
  await page.locator('.recent-section .match-card').first().click();
  await expect(page.getByRole('dialog').locator('.person-line').filter({hasText:'Ospite'})).toHaveCount(scenario.guests);
  await page.screenshot({path:`test-results/ospiti-${scenario.guests}-${scenario.slots.length}-${info.project.name}.png`,fullPage:true});
});
test('limite ospiti nella ricerca: due nel doppio e uno nel singolo',async({page},info)=>{
  const add=info.project.name==='mobile'?page.locator('.mobile-nav').getByRole('button',{name:'Aggiungi',exact:true}):page.getByRole('button',{name:'Aggiungi partita',exact:true}).first();await add.click();const dialog=page.getByRole('dialog');
  for(let i=0;i<2;i++){await dialog.getByRole('combobox').first().fill('Osp');await dialog.getByRole('option',{name:'Ospite',exact:true}).click();}
  await dialog.getByRole('combobox').first().fill('Osp');await expect(dialog.getByRole('option',{name:'Ospite',exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'1 contro 1'}).click();
  await dialog.getByRole('combobox').first().fill('Osp');await expect(dialog.getByRole('option',{name:'Ospite',exact:true})).toHaveCount(0);
});
