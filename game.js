(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const battleCanvas = document.getElementById('battle-art');
  const bctx = battleCanvas.getContext('2d');
  bctx.imageSmoothingEnabled = false;
  const W = 22, H = 16, T = 16;
  const player = { x: 8, y: 8, face: 'down', step: 0 };
  const species = [
    { name:'Bramblehare', type:'hare', element:'leaf', color:'#83a95b', dark:'#456d4c', light:'#d4e68e', hp:25, icon:'❧', attacks:['Clover Hop','Bramble Kick'] },
    { name:'Cindercub', type:'fox', element:'fire', color:'#e98652', dark:'#a94e43', light:'#ffd17e', hp:23, icon:'✦', attacks:['Ember Pounce','Tailflare'] },
    { name:'Brooklet', type:'otter', element:'water', color:'#68b6c4', dark:'#3f7189', light:'#c7eee0', hp:24, icon:'◆', attacks:['Ripple Dash','Shell Splash'] },
    { name:'Mosskin', type:'turtle', element:'leaf', color:'#76a85f', dark:'#416d53', light:'#c7dc83', hp:26, icon:'☘', attacks:['Leaf Flick','Shell Bump'] },
    { name:'Pufflet', type:'owl', element:'air', color:'#c7a6ce', dark:'#826d9d', light:'#f3d9bd', hp:20, icon:'✿', attacks:['Gust Peep','Moonfeather'] }
  ];
  const starters = species.slice(0,3);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('wildbound-save') || '{}'); } catch { return {}; } })();
  const legacyParty = Array.isArray(saved.party) ? saved.party : [];
  let starterChosen = saved.starterChosen || (starters.some(s=>s.name===legacyParty[0]?.name) ? legacyParty[0].name : null);
  let party = starterChosen ? (legacyParty.length ? legacyParty : []) : [];
  if (starterChosen && !party.length) { const starter=starters.find(s=>s.name===starterChosen)||starters[0]; party=[{name:starter.name,level:3,xp:0,hp:starter.hp,maxHp:starter.hp,type:starter.type}]; starterChosen=starter.name; }
  let capsules = Number.isFinite(saved.capsules) ? saved.capsules : 3;
  let caughtCount = Math.max(0, party.length - (starterChosen ? 1 : 0));
  let interior = false;
  let battle = null;
  let moving = false, moveTimer = null, encounterSteps = 0;
  let toastTimer;
  const ui = {
    overlay:document.getElementById('battle-overlay'), name:document.getElementById('wild-name'), level:document.getElementById('wild-level'), hpText:document.getElementById('wild-hp-text'), hpFill:document.getElementById('wild-hp-fill'), message:document.getElementById('battle-message'), actions:document.getElementById('battle-actions'), continue:document.getElementById('continue-btn'), goal:document.getElementById('goal-text'), toast:document.getElementById('toast')
  };
  function save() { try { localStorage.setItem('wildbound-save', JSON.stringify({ party, capsules, starterChosen })); } catch {} }
  function hash(x,y){ let n=(x*374761393+y*668265263)|0;n=(n^(n>>>13))*1274126177;return (n^(n>>>16))>>>0; }
  function grassPatch(x,y){ return (x>3&&x<8&&y>3&&y<8)||(x>13&&x<19&&y>2&&y<7)||(x>11&&x<17&&y>10&&y<14)||(x>1&&x<5&&y>11&&y<15); }
  function pathTile(x,y){ return Math.abs(y-(10+Math.round(Math.sin(x*.31)*2)))<=1 || (x>=6&&x<=9&&y>=7&&y<=11) || (x>=15&&x<=17&&y>=6&&y<=11); }
  function tile(x,y){
    if(x<0||y<0||x>=W||y>=H)return 'edge';
    if((x>16&&x<21&&y>1&&y<6)||(x>17&&x<20&&y>5&&y<8))return 'water';
    if(x===8&&y===6)return 'path';
    if(pathTile(x,y))return 'path';
    if(grassPatch(x,y))return 'tall';
    if((hash(x,y)%100)<12 && !((x>6&&x<10)&&(y>7&&y<11))) return 'tree';
    return 'ground';
  }
  function fill(c,x,y,w,h){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
  function drawTile(type,sx,sy,wx,wy){
    const n=hash(wx,wy);
    if(type==='ground'||type==='edge'){
      fill((n%5===0)?'#9fc878':'#a7ce7e',sx,sy,16,16);
      if(n%4===0)fill('#8fbb72',sx+((n>>4)%12),sy+((n>>8)%12),2,2);
      if(n%7===0){fill('#d4df8a',sx+4,sy+10,2,2);fill('#85ad6b',sx+7,sy+11,2,2)}
      if(type==='edge')fill('#709c69',sx,sy,16,16);
    } else if(type==='path'){
      fill('#d6c58e',sx,sy,16,16);fill('#c8b47d',sx,sy+14,16,2);
      if(n%3===0)fill('#e5d39a',sx+(n%11),sy+5,3,2);
      if(n%4===1)fill('#b9a875',sx+10,sy+10,2,2);
    } else if(type==='tall'){
      fill('#9fc878',sx,sy,16,16);
      const shift=(n%4);
      fill('#50865c',sx+2,sy+9,3,6);fill('#6d9d62',sx+1,sy+6+shift,2,5);
      fill('#4b8055',sx+8,sy+8,3,7);fill('#79a95f',sx+9,sy+4+(shift>>1),2,6);
      fill('#56895a',sx+13,sy+10,2,5);fill('#c1d77d',sx+3,sy+7,1,2);
      fill('#b4d379',sx+10,sy+5,1,2);
    } else if(type==='water'){
      fill('#72b4bb',sx,sy,16,16);fill('#6aa7b0',sx,sy+13,16,3);
      if((n&1)===0){fill('#a5d6c8',sx+3,sy+4,5,2);fill('#8ac8c0',sx+10,sy+10,4,1)}else{fill('#a5d6c8',sx+8,sy+5,5,2);fill('#8ac8c0',sx+2,sy+11,4,1)}
    } else if(type==='tree'){
      fill('#9fc878',sx,sy,16,16);fill('#806848',sx+7,sy+10,4,6);fill('#477252',sx+3,sy+5,10,8);fill('#54845b',sx+5,sy+2,7,8);fill('#729c5d',sx+7,sy+3,3,3);fill('#3c684f',sx+2,sy+9,3,3);
    }
  }
  function drawPlayer(x,y){
    const bob=(player.step%2===0)?0:1;
    // soft little shadow
    fill('#628c5b88',x+3,y+15,10,3);
    // hair and face
    fill('#584b43',x+4,y+2+bob,8,4);fill('#6b5545',x+3,y+4+bob,10,4);
    fill('#e8b88b',x+4,y+5+bob,8,6);fill('#574840',x+5,y+7+bob,1,2);fill('#574840',x+10,y+7+bob,1,2);
    // cap
    fill('#e6c46f',x+3,y+1+bob,10,3);fill('#d79b5a',x+5,y,6,2);
    // jacket, scarf, arms
    fill('#e9eee0',x+3,y+10+bob,10,2);fill('#4d8065',x+4,y+11+bob,8,5);fill('#d8a85e',x+7,y+11+bob,3,2);
    fill('#e8b88b',x+2,y+12+bob,2,4);fill('#e8b88b',x+12,y+12+bob,2,4);
    fill('#5a5547',x+4,y+16+bob,3,2);fill('#5a5547',x+9,y+16+bob,3,2);
    if(player.face==='left')fill('#403d37',x+4,y+7+bob,1,2);if(player.face==='right')fill('#403d37',x+11,y+7+bob,1,2);
  }
  function drawInterior(){
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      fill(y<2?'#9b634d':'#c99a69',x*16,y*16,16,16);
      if(y>=2){fill('#b9875e',x*16,y*16+14,16,2);if((x+y)%3===0)fill('#d7ad79',x*16+3,y*16+4,3,2)}
    }
    fill('#e5c994',16,32,320,8);fill('#794d43',0,40,16,216);fill('#794d43',336,40,16,216);
    fill('#745144',6*16,7*16,10*16,16);fill('#a77650',7*16,7*16,8*16,16);
    fill('#754936',7*16,8*16,8*16,3);fill('#bc8050',7*16+3,8*16+2,8*16-6,2);fill('#754936',7*16+8,11*16,4,3);fill('#754936',14*16-8,11*16,4,3);
    starters.forEach((sp,i)=>{const x=(7.8+i*2.15)*16,y=7.25*16;fill('#e8d8a6',x,y+1,18,3);fill(sp.color,x+2,y-6,14,7);fill('#f3eee0',x+2,y-1,14,5);fill('#d9e8d5',x+2,y-6,14,5);fill(sp.dark,x+8,y-2,3,2);fill('#fff5cc',x+5,y-5,3,2)});
    fill('#533d38',10*16,14*16,2*16,16);fill('#d8ad75',10*16+4,14*16+3,2*16-8,12);fill('#8b6250',10*16+13,14*16+7,2,2);
  }
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(interior){drawInterior();drawPlayer(player.x*16,player.y*16);document.getElementById('coords').textContent='WILLOW LODGE';requestAnimationFrame(draw);return}
    let ox=Math.max(0,Math.min(W*16-canvas.width,player.x*16+8-canvas.width/2));
    let oy=Math.max(0,Math.min(H*16-canvas.height,player.y*16+8-canvas.height/2));
    // world itself is exactly canvas size, render a fixed viewport around the character
    ox=Math.max(0,Math.min(W*16-canvas.width,player.x*16+8-canvas.width/2));
    oy=Math.max(0,Math.min(H*16-canvas.height,player.y*16+8-canvas.height/2));
    for(let sy=0;sy<canvas.height;sy+=16)for(let sx=0;sx<canvas.width;sx+=16){let wx=Math.floor((sx+ox)/16),wy=Math.floor((sy+oy)/16);drawTile(tile(wx,wy),sx-(ox%16),sy-(oy%16),wx,wy)}
    // landmarks
    const houseX=8*16-ox,houseY=4*16-oy;
    if(houseX>-35&&houseX<canvas.width&&houseY>-42&&houseY<canvas.height){fill('#a95f4e',houseX,houseY+9,32,22);fill('#754e43',houseX+4,houseY+17,24,14);fill('#d79a68',houseX+2,houseY+6,28,8);fill('#e6c581',houseX+7,houseY+22,6,9);fill('#a9c5b2',houseX+19,houseY+19,6,6);fill('#784b42',houseX+14,houseY+1,4,9)}
    const signX=10*16-ox,signY=5*16-oy;if(signX>-20&&signX<canvas.width&&signY>-20&&signY<canvas.height){fill('#79583c',signX+7,signY+5,2,10);fill('#f0d99a',signX+2,signY+2,12,7);fill('#9a8151',signX+4,signY+4,7,1)}
    const px=player.x*16-ox,py=player.y*16-oy;drawPlayer(px,py);
    document.getElementById('coords').textContent=String(player.x).padStart(2,'0')+' · '+String(player.y).padStart(2,'0');
    requestAnimationFrame(draw);
  }
  function showToast(text){ui.toast.textContent=text;ui.toast.style.opacity='1';clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.style.opacity='0',2600)}
  function drawCreature(mon){
    bctx.clearRect(0,0,144,112);const c=mon.color,d=mon.dark,l=mon.light;
    bctx.fillStyle='#72975c55';bctx.fillRect(43,91,60,8);
    const p=(x,y,w,h,col)=>{bctx.fillStyle=col;bctx.fillRect(x*4,y*4,w*4,h*4)};
    if(mon.type==='hare'){
      p(7,10,11,7,d);p(8,8,9,9,c);p(8,2,3,8,d);p(9,2,1,6,l);p(14,1,3,8,d);p(15,2,1,5,l);p(10,8,1,2,'#293c35');p(14,8,1,2,'#293c35');p(5,14,4,2,l);p(17,14,3,2,l);p(11,11,3,2,'#d7e78a');
    }else if(mon.type==='fox'){
      p(7,9,11,8,d);p(8,7,9,10,c);p(7,3,5,6,d);p(7,2,3,5,'#f6bd70');p(13,3,5,6,d);p(15,2,3,5,'#f6bd70');p(8,7,9,3,l);p(9,9,2,2,'#302f35');p(14,9,2,2,'#302f35');p(11,12,3,2,l);p(16,14,4,2,'#ffd17e');
    }else if(mon.type==='otter'){
      p(6,11,13,6,d);p(8,8,10,9,c);p(9,5,8,6,c);p(8,5,3,3,d);p(15,5,3,3,d);p(10,8,1,2,'#283f4b');p(15,8,1,2,'#283f4b');p(11,10,4,3,l);p(12,11,2,1,d);p(4,12,4,3,'#8bd2d0');p(17,12,4,2,'#8bd2d0');p(9,15,3,2,l);p(15,15,3,2,l);
    }else if(mon.type==='turtle'){
      p(6,11,13,6,d);p(8,10,9,7,c);p(8,6,9,7,'#8b704b');p(9,5,7,6,'#a88755');p(11,7,3,3,'#6c5940');p(17,9,4,4,c);p(18,10,1,1,'#263b31');p(7,15,3,2,l);p(15,15,3,2,l);p(5,12,3,2,l);
    }else{
      p(7,10,11,7,d);p(8,7,9,10,c);p(4,6,5,8,l);p(15,6,5,8,l);p(9,5,7,6,c);p(6,3,4,5,d);p(15,3,4,5,d);p(7,4,2,3,l);p(16,4,2,3,l);p(10,8,1,2,'#3c3444');p(15,8,1,2,'#3c3444');p(12,10,2,2,'#e7b45f');p(11,12,4,2,l);
    }
    p(3,5,1,1,'#fff3c1');p(20,8,1,1,'#fff3c1');p(18,3,1,1,'#fff3c1');
  }
  function updateParty(){
    const list=document.getElementById('party-list');list.innerHTML='';
    party.forEach((m,i)=>{const sp=species.find(s=>s.name===m.name)||species[0];const row=document.createElement('div');row.className='party-slot';row.innerHTML=`<div class="mini-mon" style="color:${sp.dark}">${sp.icon}</div><div><div class="party-name">${m.name}</div><div class="party-lv">LV. ${m.level||3} · ${i===0?'TRAIL PARTNER':'NEW FRIEND'}</div></div><div class="party-hp"><i style="width:${Math.max(0,(m.hp||m.maxHp||20)/(m.maxHp||20)*100)}%"></i></div>`;list.appendChild(row)});
    document.getElementById('team-count').textContent=String(party.length).padStart(2,'0')+' / 06';
    document.getElementById('capsule-count').textContent=capsules;document.getElementById('capsule-display').textContent=String(capsules).padStart(2,'0');
    document.getElementById('guide-count').textContent=Math.min(caughtCount,3)+' / 3';document.getElementById('guide-progress').style.width=Math.min(100,caughtCount/3*100)+'%';
  }
  function setBattleMessage(text){ui.message.textContent=text}
  function updateHp(){if(!battle)return;const pct=Math.max(0,battle.hp/battle.maxHp*100);ui.hpText.textContent=`${Math.max(0,battle.hp)} / ${battle.maxHp}`;ui.hpFill.style.width=pct+'%';ui.hpFill.className=pct<25?'critical':pct<50?'low':''}
  function beginBattle(){
    if(!party.length){showToast('Visit Willow Lodge to choose your trail partner first.');return}
    const wilds=species.slice(3).filter(s=>!party.some(p=>p.name===s.name));const sp=wilds[Math.floor(Math.random()*wilds.length)]||species[3];
    const lv=2+Math.floor(Math.random()*3);battle={name:sp.name,type:sp.type,element:sp.element,color:sp.color,dark:sp.dark,light:sp.light,icon:sp.icon,level:lv,maxHp:sp.hp+lv*2,hp:sp.hp+lv*2};
    const starter=species.find(s=>s.name===party[0].name)||starters[0];document.getElementById('attack-one').textContent=starter.attacks[0];document.getElementById('attack-two').textContent=starter.attacks[1];
    ui.name.textContent=battle.name;ui.level.textContent='LV. '+lv;ui.overlay.classList.remove('hidden');ui.actions.classList.remove('hidden');ui.continue.classList.add('hidden');setBattleMessage(`A wild ${battle.name} appeared!`);drawCreature(battle);updateHp();
  }
  function endBattle(text,goal){setBattleMessage(text);ui.actions.classList.add('hidden');ui.continue.classList.remove('hidden');if(goal)ui.goal.textContent=goal;}
  function wildTurn(){if(!battle||!party.length)return;const dmg=2+Math.floor(Math.random()*4);const lead=party[0];lead.hp=Math.max(0,(lead.hp??lead.maxHp??24)-dmg);if(lead.hp===0)lead.hp=lead.maxHp||24;updateParty();setBattleMessage(`${battle.name} nudged ${lead.name}! It’s still eager to explore.`)}
  function attack(attackIndex=0){if(!battle||!party.length)return;const lead=party[0],partner=species.find(s=>s.name===lead.name)||starters[0],move=partner.attacks[attackIndex];const dmg=5+Math.floor(Math.random()*6)+(lead.level||3)+(attackIndex?2:0);battle.hp=Math.max(0,battle.hp-dmg);updateHp();if(battle.hp===0){lead.xp=(lead.xp||0)+1;if(lead.xp>=3){lead.xp=0;lead.level=(lead.level||3)+1}updateParty();save();endBattle(`${battle.name} is ready to rest. ${lead.name} grew stronger!`,'Keep exploring the meadow');return}setBattleMessage(`${lead.name} used ${move}! ${battle.name} is looking a little tired.`);setTimeout(wildTurn,650)}
  function catchCreature(){if(!battle)return;if(capsules<=0){setBattleMessage('You are out of capsules. Maybe visit Nana Willow!');return}if(party.length>=6){setBattleMessage('Your team is full. There is room for six friends.');return}capsules--;updateParty();const chance=.35+(1-battle.hp/battle.maxHp)*.5;const captured=Math.random()<chance;const name=battle.name;if(captured){party.push({name,level:battle.level,xp:0,hp:battle.maxHp,maxHp:battle.maxHp,type:battle.type});caughtCount++;updateParty();save();endBattle(`${name} joined your team! What a lovely new friend.`,'Find another friendly creature');return}setBattleMessage(`${name} wiggled free! It looks a little more tired now.`);setTimeout(()=>{if(battle){battle.hp=Math.max(1,battle.hp-3);updateHp();wildTurn()}},650)}
  function runAway(){if(!battle)return;endBattle(`You waved goodbye to ${battle.name} and continued along the trail.`,'Explore the tall grass')}
  document.getElementById('attack-btn').addEventListener('click',()=>attack(0));document.getElementById('attack-two-btn').addEventListener('click',()=>attack(1));document.getElementById('catch-btn').addEventListener('click',catchCreature);document.getElementById('run-btn').addEventListener('click',runAway);
  ui.continue.addEventListener('click',()=>{battle=null;ui.overlay.classList.add('hidden');encounterSteps=0;showToast('The meadow breeze carries you onward…')});
  function tryMove(dir){if(battle)return;let dx=0,dy=0;if(dir==='up'){dy=-1;player.face='up'}if(dir==='down'){dy=1;player.face='down'}if(dir==='left'){dx=-1;player.face='left'}if(dir==='right'){dx=1;player.face='right'}const nx=player.x+dx,ny=player.y+dy;if(interior){if(nx<1||nx>20||ny<3||ny>14)return;player.x=nx;player.y=ny;player.step++;return}const typ=tile(nx,ny);if(typ==='tree'||typ==='water'||typ==='edge'){showToast(typ==='water'?'The pond is too deep to cross.':'A sturdy tree blocks the way.');return}player.x=nx;player.y=ny;player.step++;if(typ==='tall'){encounterSteps++;if(encounterSteps>2&&Math.random()<.17){beginBattle();return}}if(encounterSteps>=6&&typ!=='tall')encounterSteps=3;}
  function action(){
    if(battle)return;
    if(interior){
      if(player.y>=13&&player.face==='down'){interior=false;player.x=8;player.y=6;player.face='up';showToast('Back on the meadow trail.');return}
      if(player.face==='up'&&player.y===9&&[8,10,12].includes(player.x)){
        const starter=starters[(player.x-8)/2];
        if(starterChosen){showToast(`You already chose ${starterChosen}. ${starter.name} gives a friendly wiggle from its capsule.`);return}
        starterChosen=starter.name;party=[{name:starter.name,level:3,xp:0,hp:starter.hp,maxHp:starter.hp,type:starter.type}];caughtCount=0;updateParty();save();ui.goal.textContent='Explore the tall grass';showToast(`${starter.name} chose you! ${starter.attacks[0]} and ${starter.attacks[1]} are ready.`);return;
      }
      if(!starterChosen)showToast('Three capsules rest on the table. Face one and press Space to meet your new partner.');else showToast('Your trail partner is ready. Head to the door to explore!');return;
    }
    let nx=player.x,ny=player.y;if(player.face==='up')ny--;if(player.face==='down')ny++;if(player.face==='left')nx--;if(player.face==='right')nx++;
    if(nx===10&&ny===5){capsules=Math.min(9,capsules+2);updateParty();save();showToast('Nana Willow left two capsules by the trail sign!');return}
    if(nx===8&&ny===5){interior=true;player.x=10;player.y=13;player.face='up';showToast(starterChosen?`Welcome back! Your partner is ${starterChosen}.`:'Welcome to Willow Lodge. Choose one trail partner.');return}
    showToast(starterChosen?'The grass whispers softly. Keep exploring to meet a new friend!':'Find Willow Lodge beside the path and choose your first trail partner.');
  }
  const held=new Set();function keyDown(e){const k=e.key.toLowerCase();const dirs={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'};if(dirs[k]){e.preventDefault();if(!held.has(k)){held.add(k);tryMove(dirs[k]);moveTimer=setInterval(()=>tryMove(dirs[k]),190)}return}if(k===' '||k==='enter'){e.preventDefault();action()}}
  function keyUp(e){const k=e.key.toLowerCase();if(held.has(k)){held.delete(k);clearInterval(moveTimer)}}window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',()=>{held.clear();clearInterval(moveTimer)});
  document.querySelectorAll('.dpad button').forEach(btn=>{const dir=btn.dataset.dir;let timer;const stop=e=>{e.preventDefault();clearInterval(timer)};btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);tryMove(dir);timer=setInterval(()=>tryMove(dir),190)});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,stop))});document.getElementById('touch-action').addEventListener('pointerdown',e=>{e.preventDefault();action()});
  let soundOn=false;document.getElementById('sound-toggle').addEventListener('click',e=>{soundOn=!soundOn;e.currentTarget.textContent=soundOn?'♫':'♩';showToast(soundOn?'Birdsong is on.':'Sound muted.')});
  updateParty();if(caughtCount>0)ui.goal.textContent='Find another friendly creature';requestAnimationFrame(draw);
})();
