import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { MatchInput, Player } from '../../src/lib/domain';
import { mockAccount } from './helpers/account';

async function setup(page: Page, admin = true) {
  const mock = await mockAccount(page);
  // Even possessing the requested email must not expose controls without the
  // server's authorization response.
  mock.state.user.email = 'cogliati.diego001@gmail.com';
  const players: Player[] = [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth_user_id: mock.state.user.id, full_name: 'Diego Test', preferred_role: 'attack', banner_color: 'blue', avatar_path: null },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', auth_user_id: '22222222-2222-4222-8222-222222222222', full_name: 'Altro Giocatore', preferred_role: 'defense', banner_color: 'mint', avatar_path: null },
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', auth_user_id: '33333333-3333-4333-8333-333333333333', full_name: 'Nuovo Giocatore', preferred_role: 'both', banner_color: 'mint', avatar_path: null },
  ];
  mock.state.matches = [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', revision: 0, created_at: new Date().toISOString(), added_by: players[0].id, red_score: 6, blue_score: 10, mvp_id: null, participants: [
    { player_id: players[0].id, side: 'red', role: 'single', preferred_role_at_match: 'attack' },
    { player_id: players[1].id, side: 'blue', role: 'single', preferred_role_at_match: 'defense' },
  ] }];
  const requests = { edits: [] as Record<string, unknown>[], deletes: [] as Record<string, unknown>[], failEdit: false, failDelete: false };
  await page.route('**/rest/v1/profiles?**', route => route.fulfill({ json: players }));
  await page.route('**/rest/v1/rpc/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.split('/').at(-1);
    if (endpoint === 'is_club_admin') return route.fulfill({ json: admin });
    const body = route.request().postDataJSON();
    if (endpoint === 'admin_update_match') {
      requests.edits.push(body);
      if (requests.failEdit) return route.fulfill({ status: 400, json: { message: 'La partita è stata modificata. Ricarica la pagina prima di riprovare.' } });
      const updated = { ...mock.state.matches[0], revision: 1, red_score: body.p_red_score, blue_score: body.p_blue_score, mvp_id: body.p_mvp_id, participants: (body.p_participants as MatchInput['participants']).map(p => ({ ...p, preferred_role_at_match: players.find(x => x.id === p.player_id)!.preferred_role })) };
      mock.state.matches = [updated];
      return route.fulfill({ json: updated });
    }
    if (endpoint === 'admin_delete_match') {
      requests.deletes.push(body);
      if (requests.failDelete) return route.fulfill({ status: 403, json: { message: 'Operazione riservata agli amministratori.' } });
      mock.state.matches = [];
      return route.fulfill({ json: body.p_match_id });
    }
    return route.fulfill({ status: 400, json: { message: 'Unexpected RPC' } });
  });
  return { ...mock, requests };
}

async function enable(page: Page) {
  await page.getByRole('button', { name: 'Il mio profilo', exact: true }).click();
  await page.getByRole('switch', { name: 'Modalità sviluppatore' }).click();
  await expect(page.getByRole('switch')).toBeChecked();
  await page.locator('.profile-history .match-card').first().click();
}

test('solo l’autorizzazione server abilita lo switch; demo e utenti normali esclusi', async ({ page }) => {
  const mock = await setup(page, false); await mock.login();
  await page.getByRole('button', { name: 'Il mio profilo', exact: true }).click();
  await expect(page.getByRole('switch')).toHaveCount(0);
  await page.locator('.match-card').first().click();
  await expect(page.getByRole('button', { name: 'Modifica partita', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Elimina partita', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('button', { name: 'Esci dal tuo account' }).click();
  await page.getByRole('button', { name: /Esplora la demo/ }).click();
  await page.getByRole('button', { name: 'Il mio profilo', exact: true }).click();
  await expect(page.getByRole('switch')).toHaveCount(0);
});

test('admin: modalità disattivata inizialmente e dopo reload, nascosta sui profili altrui', async ({ page }, info) => {
  const mock = await setup(page); await mock.login();
  await page.getByRole('button', { name: 'Il mio profilo', exact: true }).click();
  await expect(page.getByRole('switch')).not.toBeChecked();
  await page.locator('.match-card').first().click();
  await expect(page.getByRole('button', { name: 'Modifica partita', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('switch').click();
  await page.screenshot({ path: `test-results/admin-profile-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Fuoricampo, vai alla classifica' }).click();
  await page.locator('.ranking-row').filter({ hasText: 'Altro Giocatore' }).click();
  await expect(page.getByRole('heading', { name: 'Un volto del club.' })).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Il mio profilo', exact: true }).click();
  await expect(page.getByRole('switch')).not.toBeChecked();
});

test('corregge giocatori, risultato e MVP, aggiorna classifica e conserva data e autore', async ({ page }, info) => {
  const mock = await setup(page); await mock.login(); await enable(page);
  await page.getByRole('button', { name: 'Modifica partita', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('spinbutton', { name: 'Gol Rossi' })).toHaveValue('6');
  await expect(dialog.getByRole('spinbutton', { name: 'Gol Blu' })).toHaveValue('10');
  await dialog.getByRole('button', { name: 'Cambia Giocatore' }).first().click();
  await dialog.getByRole('combobox', { name: 'Giocatore', exact: true }).fill('Nuovo');
  await dialog.getByRole('option', { name: 'Nuovo Giocatore' }).click();
  await dialog.getByRole('spinbutton', { name: 'Gol Rossi' }).fill('10');
  await dialog.getByRole('spinbutton', { name: 'Gol Blu' }).fill('8');
  await dialog.getByRole('combobox', { name: 'MVP della partita' }).selectOption('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  await page.screenshot({ path: `test-results/admin-edit-${info.project.name}.png`, fullPage: true });
  await dialog.getByRole('button', { name: 'Salva le modifiche' }).click();
  await expect(dialog.getByRole('heading', { name: 'La partita, nel dettaglio' })).toBeVisible();
  await expect(dialog).toContainText('Vince la squadra rossa');
  await expect(dialog).toContainText('Inserita da Diego Test');
  expect(mock.requests.edits).toHaveLength(1);
  expect(mock.requests.edits[0]).toMatchObject({ p_expected_revision: 0, p_red_score: 10, p_blue_score: 8 });
  expect(mock.requests.edits[0]).not.toHaveProperty('created_at');
  await dialog.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(page.locator('.profile-history .count-badge')).toHaveText('0');
  await page.getByRole('button', { name: 'Fuoricampo, vai alla classifica' }).click();
  await expect(page.locator('.ranking-row').filter({ hasText: 'Nuovo Giocatore' }).locator('.rank-value')).toHaveText('13pt');
  await expect(page.locator('.ranking-row').filter({ hasText: 'Altro Giocatore' }).locator('.rank-value')).toHaveText('0pt');
});

test('validazione, errore salvataggio e annullamento preservano la partita', async ({ page }) => {
  const mock = await setup(page); await mock.login(); await enable(page);
  await page.getByRole('button', { name: 'Modifica partita', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: 'Gol Rossi' }).fill('10');
  await dialog.getByRole('button', { name: 'Salva le modifiche' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Niente pareggi');
  expect(mock.requests.edits).toHaveLength(0);
  await dialog.getByRole('spinbutton', { name: 'Gol Rossi' }).fill('11');
  mock.requests.failEdit = true;
  await dialog.getByRole('button', { name: 'Salva le modifiche' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Ricarica la pagina');
  await expect(dialog.getByRole('spinbutton', { name: 'Gol Rossi' })).toHaveValue('11');
  await dialog.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Vince la squadra blu');
});

test('eliminazione: annulla, errore server e conferma rimuovono solo dopo successo', async ({ page }, info) => {
  const mock = await setup(page); await mock.login(); await enable(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Elimina partita', exact: true }).click();
  await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
  expect(mock.requests.deletes).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Elimina partita', exact: true }).click();
  await page.screenshot({ path: `test-results/admin-delete-${info.project.name}.png`, fullPage: true });
  mock.requests.failDelete = true;
  await dialog.getByRole('button', { name: 'Sì, elimina partita' }).click();
  await expect(dialog.getByRole('alert')).toContainText('riservata agli amministratori');
  expect(mock.state.matches).toHaveLength(1);
  mock.requests.failDelete = false;
  await dialog.getByRole('button', { name: 'Sì, elimina partita' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.profile-history .count-badge')).toHaveText('0');
  expect(mock.requests.deletes[1]).toMatchObject({ p_expected_revision: 0, p_match_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });
});
