(() => {
  'use strict';

  const owner = 'ivetta1208';
  const fileUrl = 'https://api.github.com/repos/ivetta1208/praktikum-instructions/contents/team-instruction.json';
  const publishedUrl = new URL('team-instruction.json', location.href);
  const text = $('published_text');
  const status = $('published_status');
  const publishStatus = $('publish_status');
  const versionPattern = /^\d+(?:\.\d+){1,2}$/;
  let published;

  function isInstruction(data) {
    return data && typeof data.text === 'string' && data.text.length > 0 &&
      (data.manualBody == null || typeof data.manualBody === 'string') &&
      versionPattern.test(data.version) && typeof data.name === 'string' &&
      typeof data.date === 'string' && Array.isArray(data.fields) &&
      data.fields.length === sel.length && data.fields.every(field => typeof field === 'string') &&
      [data.rules, data.checks].every(list => Array.isArray(list) && list.every(item => typeof item === 'string'));
  }

  function display(data) {
    published = data;
    text.textContent = data.text;
    text.hidden = false;
    $('published_actions').hidden = false;
    status.textContent = 'Опубликована версия ' + data.version + '.';
  }

  async function readPublished() {
    try {
      const response = await fetch(publishedUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data === null) {
        status.textContent = 'Общая инструкция пока не опубликована.';
        return;
      }
      if (!isInstruction(data)) throw new Error();
      display(data);
    } catch {
      status.textContent = 'Не удалось загрузить общую инструкцию. Обновите страницу.';
    }
  }

  $('published_copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(published.text);
      status.textContent = 'Версия ' + published.version + ' скопирована.';
    } catch {
      status.textContent = 'Выделите текст инструкции и скопируйте его вручную.';
    }
  };

  $('published_load').onclick = () => {
    if (!published) return;
    document.querySelectorAll('#presets button.on').forEach(button => button.classList.remove('on'));
    $('name').value = published.name;
    $('ver').value = published.version;
    $('date').value = published.date;
    sel.forEach((id, index) => {
      const field = published.fields[index];
      const option = V[id].indexOf(field);
      $(id).value = option >= 0 ? String(option) : field ? 'own' : '';
      $(id + '_o').value = field;
      $(id + '_o').style.display = $(id).value === 'own' ? 'block' : 'none';
    });
    function restore(defaults, selected) {
      return Array.from(new Set([...defaults, ...selected]), t => ({ t, on: selected.includes(t) }));
    }
    rules = restore(V.rules, published.rules);
    checks = restore(V.checks, published.checks);
    manualBody = published.manualBody ?? null;
    drawList('rules', rules);
    drawList('checks', checks);
    render();
    status.textContent = 'Версия ' + published.version + ' загружена в поля конструктора.';
  };

  function encode(value) {
    const bytes = new TextEncoder().encode(value);
    return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
  }

  function decode(value) {
    return new TextDecoder().decode(Uint8Array.from(atob(value), char => char.charCodeAt(0)));
  }

  $('publish_form').onsubmit = async event => {
    event.preventDefault();
    const version = $('ver').value.trim();
    const data = {
      version,
      name: $('name').value.trim() || 'Мой помощник',
      date: $('date').value.trim() || monthYear(),
      fields: sel.map(val),
      rules: rules.filter(item => item.on).map(item => item.t),
      checks: checks.filter(item => item.on).map(item => item.t),
      manualBody,
      text: build()
    };
    const hasText = manualBody === null ?
      data.fields[0] && data.fields[2] && data.fields[4] && data.rules.length && data.checks.length :
      manualBody.trim();
    if (!versionPattern.test(version) || !hasText) {
      publishStatus.textContent = 'Укажите версию в формате 2.0 и заполните текст инструкции.';
      return;
    }
    if (!window.confirm('Опубликовать версию ' + version + ' по открытой ссылке для команды?')) return;

    const button = $('publish_button');
    const key = $('publish_token');
    const headers = {
      Authorization: 'Bearer ' + key.value.trim(),
      Accept: 'application/vnd.github+json'
    };
    key.value = '';
    button.disabled = true;
    publishStatus.textContent = 'Проверяем доступ и сохраняем версию…';
    try {
      const account = await fetch('https://api.github.com/user', { headers });
      if (!account.ok || (await account.json()).login.toLowerCase() !== owner) {
        throw new Error('Нужен действующий ключ аккаунта владельца.');
      }
      const response = await fetch(fileUrl + '?ref=main', { headers, cache: 'no-store' });
      if (!response.ok) throw new Error('Ключу нужен доступ к репозиторию практикума.');
      const current = await response.json();
      const previous = JSON.parse(decode(current.content));
      if (previous && previous.version === version) {
        throw new Error('Эта версия уже опубликована. Укажите новый номер версии.');
      }
      const saved = await fetch(fileUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'main',
          sha: current.sha,
          message: 'Publish team instruction v' + version,
          content: encode(JSON.stringify(data, null, 2) + '\n')
        })
      });
      if (saved.status === 409 || saved.status === 422) {
        throw new Error('Инструкция изменилась во время сохранения. Обновите страницу и проверьте версию.');
      }
      if (!saved.ok) throw new Error('Не удалось сохранить. Проверьте право Contents: Read and write.');
      publishStatus.textContent = 'Версия ' + version + ' сохранена. Она появится у команды после обновления GitHub Pages.';
    } catch (error) {
      publishStatus.textContent = error instanceof TypeError ?
        'Связь с GitHub прервалась. Проверьте опубликованную версию перед повтором.' : error.message;
    } finally {
      button.disabled = false;
    }
  };

  readPublished();
})();
