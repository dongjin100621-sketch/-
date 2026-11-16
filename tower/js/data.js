'use strict';
/* 게임 자료: 계층, 직업, 몬스터, 강화, 유물, 별의 제단 */

const DATA = (() => {
  const TIERS = [
    { name: '이끼 낀 정원', en: 'OVERGROWN GARDEN', mobs: ['slime', 'shroom', 'boar', 'wasp'], mid: 'sporeking', boss: 'treant', song: 't1',
      intro: '탑의 밑동은 오래전에 버려진 정원이다. 덩굴이 돌기둥을 삼키고, 버섯이 사람 키만큼 자랐다.' },
    { name: '모래시계 신전', en: 'HOURGLASS TEMPLE', mobs: ['scorpion', 'mummy', 'sandworm', 'skeleton'], mid: 'scorpionlord', boss: 'pharaoh', song: 't2',
      intro: '모래가 거꾸로 흐르는 신전. 태양을 섬기던 왕은 죽어서도 왕좌를 내주지 않았다.' },
    { name: '얼어붙은 회랑', en: 'FROZEN HALLS', mobs: ['wolf', 'wisp', 'snowgolem', 'icebat'], mid: 'yeti', boss: 'queen', song: 't3',
      intro: '숨이 얼어 떨어지는 회랑. 별빛을 가둔 얼음 속에서 누군가 노래한다.' },
    { name: '용암 대장간', en: 'MOLTEN FORGE', mobs: ['imp', 'magmaslime', 'bomber', 'automaton'], mid: 'golem', boss: 'dragon', song: 't4',
      intro: '탑을 떠받치는 불의 심장. 쇠를 두드리던 거인들은 이제 무엇을 벼리는가.' },
    { name: '별의 첨탑', en: 'STARLIT SPIRE', mobs: ['voideye', 'shadowknight', 'starling', 'tentacle'], mid: 'watcher', boss: 'devourer', song: 't5',
      intro: '하늘이 발밑에 있다. 사라진 별들이 이곳으로 끌려와 하나씩 꺼져 간다.' }
  ];

  const CLASSES = {
    blade: { name: '카인', title: '검사', hp: 130, spd: 150, dmg: 15, atkCd: 0.36, weapon: 'w_sword', color: '#d8463c',
      atk: '세 번 이어지는 베기. 휘두르는 칼날이 적의 탄환을 지우고, 받는 피해가 10% 적습니다.', skill: { name: '회전 베기', cd: 6, desc: '칼을 휘감아 돌며 주변을 여러 번 벱니다. 도는 동안 피해를 받지 않습니다.' } },
    ranger: { name: '리라', title: '궁수', hp: 95, spd: 162, dmg: 9, atkCd: 0.23, weapon: 'w_bow', color: '#4f8a3c',
      atk: '빠르게 화살을 쏩니다. 멀리서 싸우는 데 능합니다.', skill: { name: '화살 폭풍', cd: 5.5, desc: '뒤로 물러나며 부채꼴로 화살을 퍼붓습니다. 화살이 적을 꿰뚫습니다.' } },
    mage: { name: '에온', title: '마법사', hp: 85, spd: 148, dmg: 19, atkCd: 0.48, weapon: 'w_staff', color: '#7a4ae0',
      atk: '적을 따라가 터지는 마력탄. 주변 적까지 휘말립니다.', skill: { name: '유성 낙하', cd: 7, desc: '겨눈 곳에 유성을 떨어뜨려 넓은 범위를 불태웁니다.' } }
  };

  /* 탄환 모양: orb(색, 반지름) 또는 그림 이름 */
  const BUL = {
    spore: { orb: '#9ae04a', r: 4 }, needle: { spr: 'p_shard', r: 3, tint: 'needle' }, sand: { orb: '#e8b860', r: 5 }, arrow: { spr: 'p_arrow', r: 3 },
    ice: { spr: 'p_shard', r: 4 }, snow: { orb: '#e8f4ff', r: 6 }, fire: { spr: 'p_fire', r: 5 }, void: { orb: '#b05aff', r: 5 }, star: { spr: 'p_star', r: 5 },
    rock: { spr: 'p_rock', r: 6 }, big: { orb: '#ff5a7a', r: 9 }, red: { orb: '#ff4a4a', r: 5 }, sun: { orb: '#ffb83a', r: 7 }, leaf: { orb: '#7ad84a', r: 5 },
    poison: { orb: '#c06aff', r: 5 }, frost: { orb: '#8ae4ff', r: 5 }, ember: { orb: '#ff8a2a', r: 4 }, pink: { orb: '#ff8ae0', r: 6 }, bigvoid: { orb: '#8a3aff', r: 11 },
    bouldr: { spr: 'p_boulder', r: 14 }, gold: { orb: '#ffd84a', r: 6 }
  };

  /* 몬스터. hp·dmg 는 1층 기준이고 층에 따라 커진다(scale) */
  const ENEMIES = {
    slime: { name: '초록 슬라임', spr: 'slime', hp: 24, dmg: 9, spd: 62, r: 9, ai: 'hop', cost: 1, hop: 0.85 },
    shroom: { name: '포자 버섯', spr: 'shroom', hp: 30, dmg: 8, spd: 0, r: 10, ai: 'turret', cost: 2, heavy: true, fire: { pat: 'spread', n: 3, sp: 0.42, spd: 140, cd: 2.4, b: 'spore' } },
    boar: { name: '가시 멧돼지', spr: 'boar', hp: 46, dmg: 13, spd: 55, r: 12, ai: 'charger', cost: 3, side: true, dash: { spd: 400, wind: 0.75, dur: 0.6, cd: 2.8 } },
    wasp: { name: '독침 말벌', spr: 'wasp', hp: 15, dmg: 8, spd: 115, r: 8, ai: 'flyer', cost: 1, fly: true, side: true, fire: { pat: 'aim', n: 1, spd: 190, cd: 2.6, b: 'needle' } },

    scorpion: { name: '모래 전갈', spr: 'scorpion', hp: 34, dmg: 12, spd: 70, r: 11, ai: 'charger', cost: 2, side: true, dash: { spd: 430, wind: 0.6, dur: 0.45, cd: 2.4 } },
    mummy: { name: '붕대 미라', spr: 'mummy', hp: 70, dmg: 14, spd: 42, r: 11, ai: 'tank', cost: 3, heavy: true, slam: { r: 70, wind: 0.9, cd: 3.4 } },
    sandworm: { name: '모래 벌레', spr: 'sandworm', hp: 38, dmg: 12, spd: 95, r: 11, ai: 'burrow', cost: 2, ring: { n: 8, spd: 150, b: 'sand' } },
    skeleton: { name: '해골 궁수', spr: 'skeleton', hp: 26, dmg: 10, spd: 70, r: 9, ai: 'shooter', cost: 2, range: 240, fire: { pat: 'aim', n: 1, spd: 260, cd: 2.0, b: 'arrow' } },

    wolf: { name: '서리 늑대', spr: 'wolf', hp: 30, dmg: 11, spd: 128, r: 11, ai: 'lunger', cost: 2, side: true, lunge: { spd: 360, dur: 0.3, cd: 1.8, range: 120 } },
    wisp: { name: '얼음 정령', spr: 'wisp', hp: 26, dmg: 10, spd: 70, r: 9, ai: 'orbiter', cost: 2, fly: true, fire: { pat: 'ring', n: 8, spd: 120, cd: 2.8, b: 'ice' } },
    snowgolem: { name: '눈덩이 골렘', spr: 'snowgolem', hp: 82, dmg: 15, spd: 38, r: 13, ai: 'thrower', cost: 3, heavy: true, fire: { pat: 'lob', spd: 1, cd: 3.2, b: 'snow', split: 6 } },
    icebat: { name: '얼음 박쥐', spr: 'icebat', hp: 14, dmg: 9, spd: 150, r: 8, ai: 'swoop', cost: 1, fly: true },

    imp: { name: '불꽃 임프', spr: 'imp', hp: 24, dmg: 11, spd: 90, r: 9, ai: 'shooter', cost: 2, fly: true, range: 230, fire: { pat: 'spread', n: 3, sp: 0.25, spd: 210, cd: 2.2, b: 'fire' } },
    magmaslime: { name: '용암 슬라임', spr: 'magmaslime', hp: 40, dmg: 12, spd: 60, r: 10, ai: 'hop', cost: 2, hop: 1.0, trail: true },
    bomber: { name: '화약 폭탄병', spr: 'bomber', hp: 22, dmg: 24, spd: 92, r: 9, ai: 'exploder', cost: 2, boom: { r: 62, fuse: 0.75 } },
    automaton: { name: '강철 자동인형', spr: 'automaton', hp: 64, dmg: 14, spd: 50, r: 12, ai: 'charger', cost: 3, heavy: true, dash: { spd: 380, wind: 0.8, dur: 0.7, cd: 3.0, sparks: true } },

    voideye: { name: '공허의 눈', spr: 'voideye', hp: 34, dmg: 13, spd: 50, r: 10, ai: 'laser', cost: 3, fly: true, beam: { warm: 0.9, dur: 0.5, cd: 3.6, w: 10 } },
    shadowknight: { name: '그림자 기사', spr: 'shadowknight', hp: 52, dmg: 15, spd: 72, r: 10, ai: 'blinker', cost: 3, blink: { cd: 3.2, wind: 0.55 } },
    starling: { name: '떠도는 별', spr: 'starling', hp: 28, dmg: 11, spd: 85, r: 9, ai: 'orbiter', cost: 2, fly: true, fire: { pat: 'spiral', n: 3, spd: 150, cd: 0.22, burst: 10, rest: 2.4, b: 'star' } },
    tentacle: { name: '공허 촉수', spr: 'tentacle', hp: 44, dmg: 12, spd: 0, r: 10, ai: 'turret', cost: 3, heavy: true, fire: { pat: 'spiral', n: 2, spd: 140, cd: 0.18, burst: 14, rest: 2.2, b: 'void' } }
  };

  const BOSSES = {
    sporeking: { name: '포자왕 마이코스', title: '정원의 중간 보스', spr: 'b_sporeking', hp: 1400, dmg: 14, r: 34, spd: 50 },
    treant: { name: '고목 수호자 엘더', title: '제1계층의 주인', spr: 'b_treant', hp: 2600, dmg: 15, r: 36, spd: 0 },
    scorpionlord: { name: '사막 군주 세르케트', title: '신전의 중간 보스', spr: 'b_scorpion', hp: 3200, dmg: 17, r: 40, spd: 80 },
    pharaoh: { name: '태양왕 라흐텝', title: '제2계층의 주인', spr: 'b_pharaoh', hp: 5000, dmg: 18, r: 30, spd: 60 },
    yeti: { name: '서리 예티 구르', title: '회랑의 중간 보스', spr: 'b_yeti', hp: 5600, dmg: 20, r: 36, spd: 70 },
    queen: { name: '빙결의 여왕 실바', title: '제3계층의 주인', spr: 'b_queen', hp: 8200, dmg: 20, r: 26, spd: 60 },
    golem: { name: '용광로 거인 볼칸', title: '대장간의 중간 보스', spr: 'b_golem', hp: 9200, dmg: 22, r: 40, spd: 55 },
    dragon: { name: '화염룡 이그니스', title: '제4계층의 주인', spr: 'b_dragon', hp: 13000, dmg: 23, r: 44, spd: 70 },
    watcher: { name: '심연의 감시자', title: '첨탑의 중간 보스', spr: 'b_watcher', hp: 14000, dmg: 24, r: 38, spd: 40 },
    devourer: { name: '별을 삼킨 자', title: '탑의 꼭대기', spr: 'b_devourer', hp: 22000, dmg: 26, r: 40, spd: 50 }
  };

  /* 층에 따른 강해짐 */
  const hpScale = (f) => 1 + 0.1 * (f - 1) + 0.0022 * (f - 1) * (f - 1);
  const dmgScale = (f) => 1 + 0.036 * (f - 1);
  const bossHpScale = (f) => 1 + 0.018 * (f - 1);

  /* ── 강화 ── r: 0 일반 1 희귀 2 영웅 3 전설 */
  const RARITY = [
    { name: '일반', color: '#d8d4e8', w: 60 }, { name: '희귀', color: '#5ab0ff', w: 28 },
    { name: '영웅', color: '#c070ff', w: 10 }, { name: '전설', color: '#ffb040', w: 2.5 }
  ];
  const UPG = [
    { id: 'power', name: '힘의 결정', r: 0, max: 10, icon: 'power', d: '공격력 +12%', a: (s, n) => { s.dmgMul += 0.12 * n; } },
    { id: 'haste', name: '신속의 룬', r: 0, max: 8, icon: 'haste', d: '공격 속도 +10%', a: (s, n) => { s.atkSpd += 0.1 * n; } },
    { id: 'swift', name: '바람 깃털', r: 0, max: 5, icon: 'swift', d: '이동 속도 +7%', a: (s, n) => { s.spdMul += 0.07 * n; } },
    { id: 'vigor', name: '생명의 씨앗', r: 0, max: 10, icon: 'vigor', d: '최대 체력 +20, 체력 20 회복', a: (s, n) => { s.maxHp += 20 * n; }, now: (p) => p.heal(20) },
    { id: 'keen', name: '예리한 눈', r: 0, max: 6, icon: 'keen', d: '치명타 확률 +7%', a: (s, n) => { s.crit += 0.07 * n; } },
    { id: 'brutal', name: '잔혹함', r: 0, max: 5, icon: 'brutal', d: '치명타 피해 +30%', a: (s, n) => { s.critDmg += 0.3 * n; } },
    { id: 'heal', name: '회복의 샘물', r: 0, max: 99, icon: 'heal', d: '지금 체력을 45% 회복', a: () => {}, now: (p) => p.heal(p.st.maxHp * 0.45), once: true },
    { id: 'greed', name: '황금 손', r: 0, max: 4, icon: 'greed', d: '얻는 골드 +25%', a: (s, n) => { s.goldMul += 0.25 * n; } },
    { id: 'magnet', name: '끌어당김', r: 0, max: 3, icon: 'magnet', d: '줍는 범위 +60%', a: (s, n) => { s.magnet += 0.6 * n; } },
    { id: 'guard', name: '단단한 피부', r: 0, max: 5, icon: 'guard', d: '받는 피해 -6%', a: (s, n) => { s.armor += 0.06 * n; } },

    { id: 'multi', name: '분열', r: 1, max: 4, icon: 'multi', d: '투사체 +1 (검사는 검기를 날림)', a: (s, n) => { s.proj += n; } },
    { id: 'pierce', name: '관통', r: 1, max: 3, icon: 'pierce', d: '투사체가 적 1명을 더 꿰뚫음', a: (s, n) => { s.pierce += n; } },
    { id: 'vamp', name: '흡혈', r: 1, max: 5, icon: 'vamp', d: '적을 쓰러뜨릴 때 체력 +2', a: (s, n) => { s.lifeOnKill += 2 * n; } },
    { id: 'burn', name: '불꽃 부여', r: 1, max: 3, icon: 'burn', d: '공격이 18% 확률로 3초간 불태움', a: (s, n) => { s.burn += 0.18 * n; } },
    { id: 'frost', name: '서리 부여', r: 1, max: 3, icon: 'frost', d: '공격이 20% 확률로 2초간 느리게 함', a: (s, n) => { s.slow += 0.2 * n; } },
    { id: 'dashcd', name: '잔영', r: 1, max: 3, icon: 'dashcd', d: '구르기 재사용 시간 -20%', a: (s, n) => { s.dashCd *= Math.pow(0.8, n); } },
    { id: 'dashstrike', name: '질주 베기', r: 1, max: 2, icon: 'dashstrike', d: '구르며 지나간 적에게 공격력 150% 피해', a: (s, n) => { s.dashDmg += 1.5 * n; } },
    { id: 'skillcd', name: '마력 순환', r: 1, max: 4, icon: 'skillcd', d: '스킬 재사용 시간 -15%', a: (s, n) => { s.skillCd *= Math.pow(0.85, n); } },
    { id: 'skillpow', name: '증폭', r: 1, max: 4, icon: 'skillpow', d: '스킬 피해 +35%', a: (s, n) => { s.skillDmg += 0.35 * n; } },
    { id: 'thorns', name: '가시 갑옷', r: 1, max: 3, icon: 'thorns', d: '몸에 닿은 적에게 공격력 120% 반사', a: (s, n) => { s.thorns += 1.2 * n; } },
    { id: 'regen', name: '재생', r: 1, max: 4, icon: 'regen', d: '초당 체력 0.6 회복', a: (s, n) => { s.regen += 0.6 * n; } },

    { id: 'chain', name: '연쇄 번개', r: 2, max: 3, icon: 'chain', d: '공격이 20% 확률로 주변 적 3명에게 번개(공격력 70%)', a: (s, n) => { s.chain += 0.2 * n; } },
    { id: 'boom', name: '폭발', r: 2, max: 3, icon: 'boom', d: '쓰러진 적이 터져 주변에 공격력 90% 피해', a: (s, n) => { s.boom += 0.9 * n; } },
    { id: 'orbit', name: '수호 구체', r: 2, max: 4, icon: 'orbit', d: '주위를 도는 구체 +1 (적을 치고 탄환을 지움)', a: (s, n) => { s.orbit += n; } },
    { id: 'shield', name: '보호막', r: 2, max: 3, icon: 'shield', d: '층마다 피해를 한 번 막는 보호막 +1', a: (s, n) => { s.shield += n; } },
    { id: 'berserk', name: '광폭', r: 2, max: 2, icon: 'berserk', d: '체력이 절반 아래면 공격력 +40%', a: (s, n) => { s.berserk += 0.4 * n; } },
    { id: 'giant', name: '거대화', r: 2, max: 3, icon: 'giant', d: '공격 범위·탄 크기 +25%, 공격력 +8%', a: (s, n) => { s.size += 0.25 * n; s.dmgMul += 0.08 * n; } },
    { id: 'focus', name: '집중', r: 2, max: 2, icon: 'focus', d: '멈춰 서서 공격하면 공격력 +30%', a: (s, n) => { s.focus += 0.3 * n; } },

    { id: 'phoenix', name: '불사조의 깃털', r: 3, max: 2, icon: 'phoenix', d: '쓰러지면 한 번 체력 50%로 되살아남', a: (s, n) => { s.revive += n; } },
    { id: 'blessing', name: '별의 가호', r: 3, max: 2, icon: 'blessing', d: '모든 피해 +25%, 최대 체력 +25', a: (s, n) => { s.dmgMul += 0.25 * n; s.maxHp += 25 * n; } },
    { id: 'twin', name: '쌍둥이 별', r: 3, max: 2, icon: 'twin', d: '공격이 30% 확률로 한 번 더 나감', a: (s, n) => { s.twin += 0.3 * n; } },
    { id: 'timewarp', name: '시간 왜곡', r: 3, max: 1, icon: 'timewarp', d: '구른 뒤 1.5초간 주변 적과 탄환이 느려짐', a: (s, n) => { s.timewarp += n; } }
  ];
  const UPG_BY = Object.fromEntries(UPG.map(u => [u.id, u]));

  /* ── 유물(보스가 남김) ── */
  const RELICS = [
    { id: 'sporepouch', name: '포자 주머니', icon: 'spore', d: '적을 쓰러뜨리면 30% 확률로 독 포자 구름이 피어남', a: (s) => { s.spore = 0.3; } },
    { id: 'elderheart', name: '고목의 심장', icon: 'leaf', d: '초당 체력 1.5 회복, 최대 체력 +30', a: (s) => { s.regen += 1.5; s.maxHp += 30; } },
    { id: 'stinger', name: '군주의 독침', icon: 'stinger', d: '공격이 적을 중독시킴(초당 공격력 30%, 3번 겹침)', a: (s) => { s.poison = 0.3; } },
    { id: 'suncrown', name: '태양왕의 왕관', icon: 'crown', d: '얻는 골드 +60%, 상점 물건 25% 할인', a: (s) => { s.goldMul += 0.6; s.discount = 0.25; } },
    { id: 'scarab', name: '태양 스카라베', icon: 'scarab', d: '4초마다 주변에 태양 폭발(공격력 220%)', a: (s) => { s.scarab = 2.2; } },
    { id: 'yetifur', name: '예티의 털가죽', icon: 'fur', d: '받는 피해 -15%, 최대 체력 +20', a: (s) => { s.armor += 0.15; s.maxHp += 20; } },
    { id: 'mirror', name: '여왕의 거울', icon: 'mirror', d: '탄환에 맞을 때 30% 확률로 막고 되쏘아 보냄', a: (s) => { s.mirror = 0.3; } },
    { id: 'hammer', name: '대장장이 망치', icon: 'hammer', d: '공격력 +30%', a: (s) => { s.dmgMul += 0.3; } },
    { id: 'scale', name: '용의 비늘', icon: 'scale', d: '최대 체력 +50, 용암·화상 피해 절반', a: (s) => { s.maxHp += 50; s.fireRes = 0.5; } },
    { id: 'dragonheart', name: '용의 심장', icon: 'flame', d: '구른 자리에 불길이 남음(초당 공격력 100%)', a: (s) => { s.fireTrail = 1; } },
    { id: 'eye', name: '감시자의 눈', icon: 'eye', d: '치명타 확률 +15%, 치명타 피해 +50%', a: (s) => { s.crit += 0.15; s.critDmg += 0.5; } },
    { id: 'core', name: '공허의 핵', icon: 'core', d: '스킬 재사용 시간 -35%, 스킬 피해 +30%', a: (s) => { s.skillCd *= 0.65; s.skillDmg += 0.3; } },
    { id: 'starshard', name: '별의 조각', icon: 'star', d: '투사체 +1, 관통 +1', a: (s) => { s.proj += 1; s.pierce += 1; } },
    { id: 'hourglass', name: '모래시계', icon: 'hourglass', d: '층을 오를 때마다 보호막 +1, 공격 속도 +15%', a: (s) => { s.shield += 1; s.atkSpd += 0.15; } },
    { id: 'clover', name: '네잎 토끼풀', icon: 'clover', d: '강화 다시 고르기 +3, 강화 카드가 4장', a: (s) => { s.cards = Math.max(s.cards, 4); s.extraRerolls = 3; } }
  ];
  const RELIC_BY = Object.fromEntries(RELICS.map(r => [r.id, r]));

  /* ── 별의 제단(영구 강화) ── */
  const META = [
    { id: 'life', name: '생명의 별', icon: 'vigor', d: (n) => `최대 체력 +${10 * n}`, cost: [10, 20, 35, 50, 70], a: (s, n) => { s.maxHp += 10 * n; } },
    { id: 'might', name: '힘의 별', icon: 'power', d: (n) => `공격력 +${6 * n}%`, cost: [15, 30, 45, 65, 90], a: (s, n) => { s.dmgMul += 0.06 * n; } },
    { id: 'wind', name: '질주의 별', icon: 'swift', d: (n) => `이동 속도 +${4 * n}%`, cost: [12, 25, 40], a: (s, n) => { s.spdMul += 0.04 * n; } },
    { id: 'luck', name: '행운의 별', icon: 'clover', d: (n) => `강화 다시 고르기 +${n}회`, cost: [20, 40, 70], a: (s, n) => { s.metaRerolls = n; } },
    { id: 'legacy', name: '유산의 별', icon: 'greed', d: (n) => `시작 골드 +${40 * n}`, cost: [15, 30, 50], a: () => {} },
    { id: 'blessing', name: '축복의 별', icon: 'blessing', d: () => '희귀 강화 하나를 가지고 시작', cost: [60], a: () => {} },
    { id: 'choice', name: '선택의 별', icon: 'focus', d: () => '강화 카드가 4장 나옴', cost: [120], a: (s) => { s.cards = 4; } },
    { id: 'undying', name: '불사의 별', icon: 'phoenix', d: () => '등반마다 한 번 되살아남', cost: [150], a: (s) => { s.revive += 1; } }
  ];

  return { TIERS, CLASSES, BUL, ENEMIES, BOSSES, hpScale, dmgScale, bossHpScale, RARITY, UPG, UPG_BY, RELICS, RELIC_BY, META };
})();
