// ===== 启动：MV3 content script 在 load 之后注入，不能依赖 load 事件 =====
function boot() {
  if (document.getElementById('anki-global-toolbar')) return;
  setTimeout(createGlobalToolbar, 300);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

let currentActiveEditor = null;
let toolbarPosition = null;
try { toolbarPosition = JSON.parse(localStorage.getItem('ankiToolbarPos')); } catch (e) {}

// 功能列表（可自由开关）
let featureConfig = {
  bold: true, italic: true, underline: true, strikeThrough: true,
  justifyLeft: true, justifyCenter: true,
  ul: true, ol: true,
  red: true, blue: true, green: true, yellow: true, lightblue: true,
  font12: true, font16: true, font20: true, font24: true,
  table: true, code: true,
  clear: true, clearAll: true
};

// 从localStorage加载配置
function loadFeatureConfig() {
  const savedConfig = localStorage.getItem('ankiToolbarConfig');
  if (savedConfig) {
    try {
      const config = JSON.parse(savedConfig);
      // 合并默认配置和保存的配置，确保新添加的功能也能正确加载
      for (let key in featureConfig) {
        if (Object.prototype.hasOwnProperty.call(featureConfig, key) && config.hasOwnProperty(key)) {
          featureConfig[key] = config[key];
        }
      }
    } catch (e) {
      console.error('Failed to parse saved config:', e);
    }
  }
}

// 保存配置到localStorage
function saveFeatureConfig() {
  localStorage.setItem('ankiToolbarConfig', JSON.stringify(featureConfig));
}

function createGlobalToolbar() {
  if (document.querySelector('#anki-global-toolbar')) return;

  // 加载保存的配置
  loadFeatureConfig();

  const toolbar = document.createElement('div');
  toolbar.id = 'anki-global-toolbar';

  toolbar.innerHTML = `
    <div class="toolbar-head">
      <span class="drag">≡ 拖动</span>
      <button class="config-btn">功能开关</button>
    </div>
    <div class="toolbar-body"></div>
    <div class="config-panel">
      <div class="config-title">显示哪些按钮</div>
      <div class="config-grid">
        <label><input type="checkbox" name="bold"> 加粗</label>
        <label><input type="checkbox" name="italic"> 斜体</label>
        <label><input type="checkbox" name="underline"> 下划线</label>
        <label><input type="checkbox" name="strikeThrough"> 删除线</label>
        <label><input type="checkbox" name="justifyLeft"> 左对齐</label>
        <label><input type="checkbox" name="justifyCenter"> 居中</label>
        <label><input type="checkbox" name="ul"> 无序列表</label>
        <label><input type="checkbox" name="ol"> 有序列表</label>
        <label><input type="checkbox" name="red"> 红色</label>
        <label><input type="checkbox" name="blue"> 蓝色</label>
        <label><input type="checkbox" name="green"> 绿色</label>
        <label><input type="checkbox" name="yellow"> 黄底</label>
        <label><input type="checkbox" name="lightblue"> 蓝底</label>
        <label><input type="checkbox" name="font12"> 12号</label>
        <label><input type="checkbox" name="font16"> 16号</label>
        <label><input type="checkbox" name="font20"> 20号</label>
        <label><input type="checkbox" name="font24"> 24号</label>
        <label><input type="checkbox" name="table"> 表格</label>
        <label><input type="checkbox" name="code"> 代码块</label>
        <label><input type="checkbox" name="clear"> 清选中</label>
        <label><input type="checkbox" name="clearAll"> 清全部</label>
      </div>
      <button class="config-apply">应用</button>
    </div>
  `;

  document.body.appendChild(toolbar);

  // 还原拖动位置
  if (toolbarPosition && typeof toolbarPosition.left === 'number' && typeof toolbarPosition.top === 'number') {
    toolbar.style.left = toolbarPosition.left + 'px';
    toolbar.style.top = toolbarPosition.top + 'px';
    toolbar.style.right = 'auto';
  }

  renderToolbar();
  initDrag();
  initConfig();

  // 点击编辑区时记录当前激活的编辑器
  document.addEventListener('click', (e) => {
    const ed = e.target.closest('.field-editor,[contenteditable="true"],.note-editor,.editor-field');
    if (ed) { currentActiveEditor = ed; }
  });

  // 阻止点击工具栏按钮时编辑器丢失选区（否则 execCommand 拿不到选中文本）
  toolbar.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-cmd],[data-func]')) e.preventDefault();
  });

  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cmd],[data-func]');
    if (!btn) return;
    if (!currentActiveEditor) { alert('请先点击卡片输入框'); return; }

    currentActiveEditor.focus();

    const sel = window.getSelection();
    const range = sel.rangeCount ? sel.getRangeAt(0) : null;
    const inEditor = range && currentActiveEditor.contains(range.commonAncestorContainer);
    const hasSelection = !!(inEditor && !range.collapsed);

    const cmd = btn.dataset.cmd;
    const val = btn.dataset.val;
    const func = btn.dataset.func;

    // 需要选区的功能：未选中则提示（与 readme 一致）
    const needsSel = cmd === 'foreColor' || cmd === 'hiliteColor' || func === 'font';
    if (needsSel && !hasSelection) { alert('请先选中文字'); return; }

    // 让颜色以 inline style 写入，Anki 渲染更可靠
    if (cmd === 'foreColor' || cmd === 'hiliteColor') {
      document.execCommand('styleWithCSS', false, true);
    }

    if (cmd) {
      document.execCommand(cmd, false, val);
      setTimeout(() => currentActiveEditor.focus(), 0);
    }

    if (func === 'font') {
      applyFontSize(btn.dataset.size);
    }

    if (func === 'table') {
      const t = '<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse"><tr><td>A1</td><td>B1</td></tr><tr><td>A2</td><td>B2</td></tr></table>';
      document.execCommand('insertHTML', false, t);
      setTimeout(() => currentActiveEditor.focus(), 0);
    }

    if (func === 'code') {
      const text = range ? range.toString() : '';
      const codeHtml = '<pre style="background:#f5f5f5;padding:8px;border-radius:4px;font-family:monospace;white-space:pre-wrap;">'
        + escapeHtml(text) + '</pre><br>';
      document.execCommand('insertHTML', false, codeHtml);
      setTimeout(() => currentActiveEditor.focus(), 0);
    }

    if (func === 'clear') {
      document.execCommand('removeFormat', false, null);
      setTimeout(() => currentActiveEditor.focus(), 0);
    }

    if (func === 'clearAll') {
      // 用 textContent 重建，保留文本但清除格式与结构嵌套
      currentActiveEditor.innerHTML = currentActiveEditor.textContent;
      setTimeout(() => currentActiveEditor.focus(), 0);
    }
  });
}

// 字体大小：用 extractContents+insertNode 包裹，避免 surroundContents 在跨标签选区时抛异常
function applyFontSize(size) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  if (r.collapsed) return;
  const span = document.createElement('span');
  span.style.fontSize = size + 'px';
  try {
    span.appendChild(r.extractContents());
    r.insertNode(span);
    sel.removeAllRanges();
    const nr = document.createRange();
    nr.selectNodeContents(span);
    sel.addRange(nr);
  } catch (e) {
    console.error('字体设置失败:', e);
  }
  setTimeout(() => currentActiveEditor && currentActiveEditor.focus(), 0);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 渲染工具栏（根据开关）
function renderToolbar() {
  const body = document.querySelector('.toolbar-body');
  if (!body) return;
  body.innerHTML = '';

  const items = [
    { name: 'bold', html: '<button data-cmd="bold">B 加粗</button>' },
    { name: 'italic', html: '<button data-cmd="italic">斜体</button>' },
    { name: 'underline', html: '<button data-cmd="underline">下划线</button>' },
    { name: 'strikeThrough', html: '<button data-cmd="strikeThrough">S</button>' },
    { name: 'justifyLeft', html: '<button data-cmd="justifyLeft">左对齐</button>' },
    { name: 'justifyCenter', html: '<button data-cmd="justifyCenter">居中</button>' },
    { name: 'ul', html: '<button data-cmd="insertUnorderedList">• 列表</button>' },
    { name: 'ol', html: '<button data-cmd="insertOrderedList">1. 列表</button>' },
    { name: 'red', html: '<button data-cmd="foreColor" data-val="red">红</button>' },
    { name: 'blue', html: '<button data-cmd="foreColor" data-val="blue">蓝</button>' },
    { name: 'green', html: '<button data-cmd="foreColor" data-val="green">绿</button>' },
    { name: 'yellow', html: '<button data-cmd="hiliteColor" data-val="yellow">黄底</button>' },
    { name: 'lightblue', html: '<button data-cmd="hiliteColor" data-val="#d1f7ff">蓝底</button>' },
    { name: 'font12', html: '<button data-func="font" data-size="12">12号</button>' },
    { name: 'font16', html: '<button data-func="font" data-size="16">16号</button>' },
    { name: 'font20', html: '<button data-func="font" data-size="20">20号</button>' },
    { name: 'font24', html: '<button data-func="font" data-size="24">24号</button>' },
    { name: 'table', html: '<button data-func="table">表格</button>' },
    { name: 'code', html: '<button data-func="code">代码块</button>' },
    { name: 'clear', html: '<button data-func="clear">清选中</button>' },
    { name: 'clearAll', html: '<button data-func="clearAll">清全部</button>' },
  ];

  items.forEach(i => {
    if (featureConfig[i.name]) body.innerHTML += i.html;
  });
}

// 拖动（含位置持久化）
function initDrag() {
  const bar = document.getElementById('anki-global-toolbar');
  const drag = bar.querySelector('.drag');
  let dragging = false, ox = 0, oy = 0;

  drag.addEventListener('mousedown', e => {
    dragging = true;
    ox = e.clientX - bar.offsetLeft;
    oy = e.clientY - bar.offsetTop;
    bar.style.opacity = '0.8';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    bar.style.left = (e.clientX - ox) + 'px';
    bar.style.top = (e.clientY - oy) + 'px';
    bar.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    bar.style.opacity = '1';
    localStorage.setItem('ankiToolbarPos', JSON.stringify({ left: bar.offsetLeft, top: bar.offsetTop }));
  });
}

// 配置面板
function initConfig() {
  const bar = document.getElementById('anki-global-toolbar');
  const cfgBtn = bar.querySelector('.config-btn');
  const panel = bar.querySelector('.config-panel');
  const apply = bar.querySelector('.config-apply');

  cfgBtn.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  panel.style.display = 'none';

  // 同步勾选状态
  Object.keys(featureConfig).forEach(k => {
    const i = panel.querySelector(`[name="${k}"]`);
    if (i) i.checked = featureConfig[k];
  });

  apply.addEventListener('click', () => {
    document.querySelectorAll('.config-panel input').forEach(i => {
      featureConfig[i.name] = i.checked;
    });
    renderToolbar();
    saveFeatureConfig(); // 保存配置到localStorage
    panel.style.display = 'none';
  });
}
