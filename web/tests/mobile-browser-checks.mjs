import assert from "node:assert/strict";

// Run via the Browser skill's tab and viewport handles, on a local test save.
// This uses only documented Browser APIs; it does not read private browser stores.
export async function checkGameLayouts(tab, viewport) {
  const results = [];
  for (const [width, height] of [[320,568],[360,740],[390,844],[430,932],[768,1024],[1024,768],[1440,900],[844,390],[390,340]]) {
    await viewport.set({ width, height });
    await tab.playwright.domSnapshot();
    await tab.playwright.locator('.desktop-status').waitFor({ state: width > 1050 ? 'visible' : 'hidden' });
    await tab.playwright.locator(`html[data-short-viewport="${height < 500}"]`).waitFor({ state: 'attached' });
    const layout = await tab.playwright.evaluate(() => {
      const messages = document.querySelector('.messages');
      const input = document.querySelector('.composer textarea');
      const send = document.querySelector('.send-button');
      return {
        width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth,
        messages: messages.getBoundingClientRect().toJSON(),
        input: input.getBoundingClientRect().toJSON(),
        send: send.getBoundingClientRect().toJSON(),
        image: getComputedStyle(messages).backgroundImage,
        fontSize: getComputedStyle(input).fontSize,
        sidePanelVisible: document.querySelector('.desktop-status')?.getBoundingClientRect().width > 0,
      };
    });
    assert.ok(layout.pageWidth <= width + 1, `horizontal overflow at ${width}`);
    assert.ok(layout.messages.height >= 40, `dialogue collapsed at ${width}×${height}`);
    assert.ok(layout.send.bottom <= height + 1, `send button below viewport at ${width}×${height}`);
    assert.ok(layout.send.left >= 0 && layout.send.right <= width, `send outside viewport at ${width}`);
    assert.ok(layout.input.width > 100, `input too narrow at ${width}`);
    if (width <= 720) {
      assert.match(layout.image, /\/images\/mobile\/.*\.webp/);
      assert.doesNotMatch(layout.image, /\.png/);
      assert.ok(parseFloat(layout.fontSize) >= 16);
    }
    if (width > 1050) assert.equal(layout.sidePanelVisible, true, `desktop status missing at ${width}`);
    results.push({ width, height, messageHeight: layout.messages.height, pass: true });
  }
  return results;
}

export async function checkGameMenu(tab) {
  await tab.playwright.getByRole('button', { name: '菜单 ☰' }).click();
  await tab.playwright.getByRole('dialog', { name: '归航 · 游戏菜单' }).waitFor({ state: 'visible', timeoutMs: 2000 });
  assert.equal(await tab.playwright.getByRole('dialog').count(), 1);
  assert.equal(await tab.playwright.locator('main').getAttribute('inert'), '');
  await tab.playwright.getByRole('button', { name: '♫ 音乐设置', exact: true }).click();
  await tab.playwright.getByRole('dialog', { name: '音空间', exact: true }).waitFor({ state: 'visible' });
  assert.equal(await tab.playwright.getByRole('dialog').count(), 1);
  await tab.playwright.getByRole('button', { name: '返回游戏菜单' }).click();
  await tab.playwright.getByRole('dialog', { name: '归航 · 游戏菜单' }).waitFor({ state: 'visible' });
  await tab.playwright.getByRole('button', { name: '关闭归航 · 游戏菜单' }).click();
  await tab.playwright.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await tab.playwright.locator('main').getAttribute('inert'), null);
  return { menu: 'pass', singleDialog: 'pass', backgroundRestored: 'pass' };
}

export async function completeLocalStory(tab) {
  assert.match(await tab.url(), /^http:\/\/localhost:/, 'Only advance a local test save');
  const records = [];
  for (let step = 0; step < 30; step++) {
    await tab.playwright.domSnapshot();
    if (await tab.playwright.getByRole('link', { name: '查看阶段结算 →' }).isVisible()) return records;
    const continueButton = tab.playwright.getByRole('button', { name: '进入第三幕 →', exact: true });
    if (await continueButton.isVisible()) {
      await continueButton.click();
      await tab.playwright.locator('.suggestions button').first().waitFor({ state: 'visible' });
      records.push('第三幕续接通过');
      continue;
    }
    const suggestion = tab.playwright.locator('.suggestions button').first();
    const text = await suggestion.innerText();
    records.push(text);
    await suggestion.click();
    await tab.playwright.getByRole('button', { name: '发送', exact: true }).click();
    if (/强行|引爆|点燃|牺牲|抽取寿命|杀死|攻击|刺杀|偷袭|偷取|抢夺|射击|屠灭|接管身体|直接连接|最低功率/.test(text)) {
      await tab.playwright.getByRole('dialog', { name: '不可逆行动确认' }).waitFor({ state: 'visible' });
      assert.equal(await tab.playwright.getByRole('dialog').count(), 1);
      await tab.playwright.getByRole('button', { name: '确认并承担代价' }).click();
    }
    await tab.playwright.getByRole('button', { name: text, exact: true }).waitFor({ state: 'hidden' });
  }
  throw new Error('Story did not complete within 30 actions');
}
