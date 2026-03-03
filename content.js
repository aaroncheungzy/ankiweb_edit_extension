window.addEventListener('load', function () {
  setTimeout(() => {
    createGlobalToolbar();
  }, 1500);
});

let currentActiveEditor = null;

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

function createGlobalToolbar() {
  if (document.querySelector('#anki-global-toolbar')) return;

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
  renderToolbar();
  initDrag();
  initConfig();

  document.addEventListener('click', (e) => {
    const ed = e.target.closest('.field-editor,[contenteditable="true"],.note-editor,.editor-field');
    if (ed) { currentActiveEditor = ed; ed.focus(); }
  });

  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cmd],[data-func]');
    if (!btn || !currentActiveEditor) return;

    currentActiveEditor.focus();
    const sel = window.getSelection();
    const range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (range && !currentActiveEditor.contains(range.commonAncestorContainer)) return;

    const cmd = btn.dataset.cmd;
    const val = btn.dataset.val;
    const func = btn.dataset.func;

    if (cmd) {
      document.execCommand(cmd, false, val);
      setTimeout(()=>currentActiveEditor.focus(),0);
    }

    if (func === 'font') {
      const size = btn.dataset.size;
      document.execCommand('removeFormat',false,null);
      const span = document.createElement('span');
      span.style.fontSize = size + 'px';
      if(range) range.surroundContents(span);
      setTimeout(()=>currentActiveEditor.focus(),0);
    }

    if (func === 'table') {
      const t = '<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse"><tr><td>A1</td><td>B1</td></tr><tr><td>A2</td><td>B2</td></tr></table>';
      document.execCommand('insertHTML',false,t);
      setTimeout(()=>currentActiveEditor.focus(),0);
    }

    if (func === 'code') {
      document.execCommand('formatBlock',false,'<pre>');
      const pre = currentActiveEditor.querySelector('pre:last-child');
      if(pre) pre.style.cssText='background:#f5f5f5;padding:8px;border-radius:4px';
      setTimeout(()=>currentActiveEditor.focus(),0);
    }

    if (func === 'clear') {
      document.execCommand('removeFormat',false,null);
      setTimeout(()=>currentActiveEditor.focus(),0);
    }

    if (func === 'clearAll') {
      if(currentActiveEditor.isContentEditable) currentActiveEditor.innerText = currentActiveEditor.innerText;
      else if(currentActiveEditor.tagName==='TEXTAREA') currentActiveEditor.value=currentActiveEditor.value.replace(/<[^>]+>/g,'');
      setTimeout(()=>currentActiveEditor.focus(),0);
    }
  });
}

// 渲染工具栏（根据开关）
function renderToolbar() {
  const body = document.querySelector('.toolbar-body');
  if(!body) return;
  body.innerHTML = '';

  const items = [
    {name:'bold', html:'<button data-cmd="bold">B 加粗</button>'},
    {name:'italic', html:'<button data-cmd="italic">斜体</button>'},
    {name:'underline', html:'<button data-cmd="underline">下划线</button>'},
    {name:'strikeThrough', html:'<button data-cmd="strikeThrough">S</button>'},
    {name:'justifyLeft', html:'<button data-cmd="justifyLeft">左对齐</button>'},
    {name:'justifyCenter', html:'<button data-cmd="justifyCenter">居中</button>'},
    {name:'ul', html:'<button data-cmd="insertUnorderedList">• 列表</button>'},
    {name:'ol', html:'<button data-cmd="insertOrderedList">1. 列表</button>'},
    {name:'red', html:'<button data-cmd="foreColor" data-val="red">红</button>'},
    {name:'blue', html:'<button data-cmd="foreColor" data-val="blue">蓝</button>'},
    {name:'green', html:'<button data-cmd="foreColor" data-val="green">绿</button>'},
    {name:'yellow', html:'<button data-cmd="hiliteColor" data-val="yellow">黄底</button>'},
    {name:'lightblue', html:'<button data-cmd="hiliteColor" data-val="#d1f7ff">蓝底</button>'},
    {name:'font12', html:'<button data-func="font" data-size="12">12号</button>'},
    {name:'font16', html:'<button data-func="font" data-size="16">16号</button>'},
    {name:'font20', html:'<button data-func="font" data-size="20">20号</button>'},
    {name:'font24', html:'<button data-func="font" data-size="24">24号</button>'},
    {name:'table', html:'<button data-func="table">表格</button>'},
    {name:'code', html:'<button data-func="code">代码块</button>'},
    {name:'clear', html:'<button data-func="clear">清选中</button>'},
    {name:'clearAll', html:'<button data-func="clearAll">清全部</button>'},
  ];

  items.forEach(i => {
    if(featureConfig[i.name]) body.innerHTML += i.html;
  });
}

// 拖动
function initDrag() {
  const bar = document.getElementById('anki-global-toolbar');
  const drag = bar.querySelector('.drag');
  let dragging=false,ox=0,oy=0;

  drag.addEventListener('mousedown',e=>{
    dragging=true;
    ox=e.clientX - bar.offsetLeft;
    oy=e.clientY - bar.offsetTop;
    bar.style.opacity='0.8';
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging) return;
    bar.style.left = e.clientX - ox + 'px';
    bar.style.top = e.clientY - oy + 'px';
  });
  document.addEventListener('mouseup',()=>{
    dragging=false;
    bar.style.opacity='1';
  });
}

// 配置面板
function initConfig() {
  const bar = document.getElementById('anki-global-toolbar');
  const cfgBtn = bar.querySelector('.config-btn');
  const panel = bar.querySelector('.config-panel');
  const apply = bar.querySelector('.config-apply');

  cfgBtn.addEventListener('click',()=>{
    panel.style.display = panel.style.display==='none'?'block':'none';
  });
  panel.style.display='none';

  // 同步勾选状态
  Object.keys(featureConfig).forEach(k=>{
    const i = panel.querySelector(`[name="${k}"]`);
    if(i) i.checked = featureConfig[k];
  });

  apply.addEventListener('click',()=>{
    document.querySelectorAll('.config-panel input').forEach(i=>{
      featureConfig[i.name] = i.checked;
    });
    renderToolbar();
    panel.style.display='none';
  });
}