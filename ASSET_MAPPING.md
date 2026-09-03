# ASSET_MAPPING — 新版素材 → 游戏 → 界面 → 组件 → 功能

> 素材根目录 `apps/client-game/public/assets/`，运行时通过 `asset(group, key)`（`src/assets/assets.ts`）读取；
> key 由文件名自动生成（`btn_spin.png → slots.btnSpin`），清单：`public/assets-manifest.json`。
> 状态：✅ 已接入 · 🔧 本轮接入中 · 📦 已入库备用（装饰 / 后续功能）。
> 规则：素材只承担 背景 / 框 / 按钮 / 图标 / 角色 / 装饰；所有动态数字（金币 / 倒计时 / Jackpot / 倍率 / HP / 排名）由程序 Text 绘制。
> `_zh` 后缀 = 烙有中文文案的成品按钮或演出，仅 `locale === 'zh'` 使用；韩文环境由 `GameButton` 用 CSS 板件 + 程序文字渲染。

## 1. 公共（common）

| 素材文件 | 游戏 | 界面 | 组件 | 功能 | 状态 |
| --- | --- | --- | --- | --- | --- |
| common/currency/icon_coin_lg.png | 全部 | 顶栏 / HUD | `CurrencyBar` | 金币图标（数字程序绘制） | 🔧 |
| common/currency/icon_gem_blue.png | 全部 | 顶栏 / HUD | `CurrencyBar` | 钻石图标 | 🔧 |
| common/currency/plate_coin.png / plate_diamond.png | 全部 | 顶栏 / HUD | `CurrencyBar` | 资产胶囊底板（数字已抹） | 🔧 |
| common/currency/plate_coin_wide.png / plate_diamond_wide.png | 水果机 / 轮盘 | 底栏 | `CurrencyBar size=wide` | 宽版资产胶囊 | 🔧 |
| common/currency/icon_coin_dollar.png / icon_coin_tilt.png / coin_stack.png | 全部 | 奖励演出 | `RewardAnimation` | 金币雨 / 金币飞入 | 🔧 |
| common/currency/icon_gem_red.png / icon_gem_purple.png / icon_gold_ingot.png | 全部 | 奖励演出 / 商城 | `RewardAnimation` / `ShopPanel` | 奖励粒子、商品图 | 🔧 |
| common/vip/vip_badge_wings.png | 全部 | 顶栏 / 玩家资料 | `VipBadge` | VIP 徽章（等级数字程序绘制） | 🔧 |
| common/vip/vip_crown.png | 大厅 | VIP 面板 | `VipBadge size=lg` | VIP 王冠 | 🔧 |
| common/avatar/avatar_caishen.png / avatar_shark.png / avatar_caishen_round.png | 全部 | 玩家资料 | `PlayerProfile` | 头像框（头像本体沿用 AvatarBadge 纹章） | 🔧 |
| common/frames/player_level_plate.png | 全部 | 玩家资料 | `PlayerProfile` | 昵称 / 等级板（文字程序绘制） | 🔧 |
| common/buttons/btn_info_round.png | 全部 | 游戏内 | `GameButton variant=round` | 规则说明 → `openRules()` | 🔧 |
| common/buttons/btn_sound_round.png | 全部 | 游戏内 | `GameButton variant=round` | 音效开关 → `AudioManager.toggle()` | 🔧 |
| common/buttons/btn_settings_round.png | 全部 | 顶栏 | `GameButton variant=round` | 设置弹层 → `openSettings()` | 🔧 |
| common/buttons/btn_exit_round.png | 全部 | 游戏内 | `GameButton variant=round` | 退出回大厅 → `exit()` | 🔧 |
| common/buttons/btn_menu_round.png / btn_trophy_round.png / btn_badge_round.png | 全部 | 游戏内 | `GameButton variant=round` | 菜单 / 排行 / 成就 | 📦 |
| common/buttons/btn_arrow_left/right/up/down.png | 全部 | 分页 / 场次切换 | `GameButton variant=arrow` | 翻页 | 🔧 |
| common/buttons/btn_arrow_yellow.png / btn_arrow_blue.png | 红十 / 麻将 | 出牌指示 | `TurnIndicator` | 轮到谁箭头 | 🔧 |
| common/buttons/toggle_on.png / toggle_off.png | 全部 | 设置 / 自动 | `GameToggle` | 开关（自动 / 音乐 / 音效） | 🔧 |
| common/buttons/btn_red_round.png | 全部 | 弹窗 | `GamePopup` | 关闭 | 📦 |
| common/popup/popup_cream_red.png / popup_cream_blue.png / popup_blue.png / popup_ribbon_red.png | 全部 | 弹窗 | `GamePopup skin=…` | 结算 / 规则 / 确认弹窗底框（9-slice） | ✅ |
| common/frames/frame_*.png（black_wide / blue_wide / red_wide / blue_shield / red_ornate / round_black / *_tall / *_sm） | 全部 | 面板 | `GamePanel skin=…` | 列表 / 卡片底框 | 🔧 |
| common/frames/plate_red_sm.png / plate_blue_sm.png | 全部 | 标签 | `GamePanel size=sm` | 标题条 | 📦 |
| common/effects/progress_bar_dragon.png / progress_bar_chest.png | 全部 | 任务 / VIP 进度 | `ProgressBar` | 进度框（填充程序绘制） | 🔧 |
| common/effects/sparkle_coin.png | 全部 | 奖励演出 | `RewardAnimation` | 闪光粒子 | 🔧 |
| common/icons/icon_event_gift.png / icon_gift_round.png / icon_event_gift_2.png | 大厅 | 功能栏 | `LobbyFeatureButton` | 活动 → `openActivity()` | 🔧 |
| common/icons/icon_daily_bonus_bag.png / icon_checkin.png | 大厅 | 功能栏 | `LobbyFeatureButton` | 福利 / 签到 → `openSignin()` | 🔧 |
| common/icons/icon_task_scroll.png / icon_task_round.png | 大厅 | 功能栏 | `LobbyFeatureButton` | 任务 → `openTasks()` | 🔧 |
| common/icons/icon_mail.png / icon_mail_round.png / icon_mail_2.png | 大厅 | 功能栏 | `LobbyFeatureButton` | 邮件 → `openMail()`（未读角标程序绘制） | 🔧 |
| common/icons/icon_vip_crown.png | 大厅 | 功能栏 | `LobbyFeatureButton` | VIP → `openVip()` | 🔧 |
| common/navigation/nav_icon_rank.png / icon_megaphone_round.png | 大厅 | 功能栏 | `LobbyFeatureButton` | 排行榜 / 公告 | 🔧 |
| common/icons/icon_treasure_chest.png / icon_chest_round.png / icon_shop_ingot.png | 大厅 | 功能栏 / 商城 | `LobbyFeatureButton` / `ShopPanel` | 宝箱 / 商城 → `openShop()` | 🔧 |
| common/icons/icon_lucky_wheel.png / icon_wheel_2.png | 大厅 | 活动 | `ActivityPanel` | 转盘活动入口（活动类型 `wheel`，后续） | 📦 |
| common/icons/icon_friends_round.png / icon_chat_round.png / icon_free_coins.png / icon_gift_box.png | 大厅 | 功能栏 / 好友 | `LobbyFeatureButton` | 好友 / 聊天 / 免费金币（签到）/ 礼包 | 🔧 |
| common/navigation/nav_icon_home / mahjong / trophy / friends / rank / bag / settings.png | 大厅 | 底部导航 | `GameNavbar` | 大厅 / 游戏 / 比赛 / 好友 / 背包 / 商城（文字程序绘制） | 🔧 |
| common/navigation/nav_plate_red.png / nav_plate_blue.png | 大厅 | 底部导航 | `GameNavbar` | 选中 / 未选中底板 | 🔧 |
| common/chips/chip_10_sm … chip_500_sm.png · chip_1k … chip_100k.png | 轮盘 / 股票 / 红十 | 下注区 | `BetChip` | 选择筹码面额 → `selectChip(n)` | 🔧 |
| common/icons/icon_crown_round.png / icon_anchor_round.png / icon_ancient_coin_round.png | 捕鱼 | HUD | `FishingHud` | 场次 / 段位小图标 | 📦 |
| common/currency/icon_gem_blue_lg / _2 / _3 / icon_gem_red_2 / icon_gem_blue_sm | 全部 | 商城 / 演出 | `ShopPanel` / `RewardAnimation` | 钻石商品图、粒子 | 📦 |

## 2. 大厅（lobby）

| 素材文件 | 游戏 | 界面 | 组件 | 功能 | 状态 |
| --- | --- | --- | --- | --- | --- |
| lobby/game_icons/icon_game_fishing.png | 大厅 | 游戏区 | `GameEntryCard` | 进入捕鱼 → `router.push('/game/fishing')` | 🔧 |
| lobby/game_icons/icon_game_slots.png | 大厅 | 游戏区 | `GameEntryCard` | 进入水果机 → `/game/slot` | ✅ |
| lobby/game_icons/icon_game_roulette.png | 大厅 | 游戏区 | `GameEntryCard` | 进入轮盘 → `/game/roulette` | 🔧 |
| lobby/game_icons/icon_game_stock.png | 大厅 | 游戏区 | `GameEntryCard` | 进入股票玩法 → `/game/stock` | 🔧 |
| lobby/banners/logo_mahjong_master.png | 大厅 | 游戏区 | `GameEntryCard` | 进入麻将 → 场次选择 → 匹配 | 🔧 |
| lobby/banners/logo_red10.png | 大厅 | 游戏区 | `GameEntryCard` | 进入红十 → 场次选择 → 匹配 | 🔧 |
| lobby/game_icons/icon_tournament.png | 大厅 | 底部导航 / 比赛 | `TournamentPanel` | 赛事列表 → `GET /api/v1/tournaments` | 🔧 |
| lobby/game_icons/icon_daily_rewards.png / icon_daily_gift.png / icon_welfare_gift.png | 大厅 | 功能栏 | `LobbyFeatureButton` | 每日奖励 / 福利 → 签到 | 🔧 |
| lobby/game_icons/icon_event_board.png / icon_task_board.png | 大厅 | 功能栏 | `LobbyFeatureButton` | 活动 / 任务 | 🔧 |
| lobby/game_icons/icon_lucky_wheel.png / icon_lucky_wheel_2.png | 大厅 | 活动 | `ActivityPanel` | 转盘活动（后续） | 📦 |
| lobby/game_icons/icon_first_topup.png / icon_topup_chest.png / icon_cashback.png | 大厅 | — | — | **不接入充值语义**；仅作宝箱 / 返利活动图（虚拟资产） | 📦 |
| lobby/game_icons/icon_fishing_contest.png | 大厅 | 比赛 | `TournamentPanel` | 捕鱼赛事图标 | 🔧 |

## 3. 捕鱼（fishing）

| 素材文件 | 游戏 | 界面 | 组件 | 功能 | 状态 |
| --- | --- | --- | --- | --- | --- |
| fishing/cannon/cannon_lv01.png | 捕鱼 | GameScene | `Cannon` | 倍率 1–2 档炮台（Pixi Sprite，随倍率切换） | 🔧 |
| fishing/cannon/cannon_lv02.png | 捕鱼 | GameScene | `Cannon` | 倍率 5 档炮台 | 🔧 |
| fishing/cannon/cannon_lv03.png | 捕鱼 | GameScene | `Cannon` | 倍率 10+ 档炮台 | 🔧 |
| fishing/fish/fish_clown.png | 捕鱼 | GameScene | `FishSprite`（对象池） | typeId `clown` / `sardine`(染色) / `butterfly`(染色) | 🔧 |
| fishing/fish/fish_puffer.png | 捕鱼 | GameScene | `FishSprite` | `puffer` / `lionfish`(染色) | 🔧 |
| fishing/fish/fish_turtle.png | 捕鱼 | GameScene | `FishSprite` | `turtle` / `ray`(染色) | 🔧 |
| fishing/fish/fish_shark_01.png | 捕鱼 | GameScene | `FishSprite` | `shark` | 🔧 |
| fishing/fish/fish_shark_purple.png | 捕鱼 | GameScene | `FishSprite` | `whale`（Boss 波次，放大 + 光环） | 🔧 |
| fishing/fish/fish_golden.png | 捕鱼 | GameScene | `FishSprite` | `goldenShark` | 🔧 |
| fishing/boss/boss_caishen_fish.png | 捕鱼 | GameScene | `BossSprite` | `dragonKing`→ 财神鱼 Boss（HP 条程序绘制） | 🔧 |
| fishing/boss/boss_caishen_fish_portrait.png / _round.png | 捕鱼 | HUD / 预警 | `BossBanner` | Boss 来袭预警 / HP 条头像 | 🔧 |
| fishing/skills/skill_lightning.png | 捕鱼 | HUD | `SkillButton` | `useSkill('LIGHTNING')` → 服务端判定 | 🔧 |
| fishing/skills/skill_missile.png | 捕鱼 | HUD | `SkillButton` | `useSkill('MISSILE')` | 🔧 |
| fishing/skills/skill_laser.png | 捕鱼 | HUD | `SkillButton` | `useSkill('LASER')` | 🔧 |
| fishing/skills/skill_nuke.png | 捕鱼 | HUD | `SkillButton` | `useSkill('NUKE')` | 🔧 |
| fishing/skills/skill_freeze.png | 捕鱼 | HUD | `SkillButton` | `useSkill('FREEZE')` | 🔧 |
| fishing/skills/skill_lock.png | 捕鱼 | HUD | `SkillButton` | `toggleLock()` 锁定目标 | 🔧 |
| fishing/ui/btn_auto_fire.png | 捕鱼 | HUD | `GameButton art` | `toggleAuto()` | 🔧 |
| fishing/ui/btn_bet_minus.png / btn_bet_plus.png | 捕鱼 | HUD | `GameButton art` | `stepMultiplier(±1)` | 🔧 |
| fishing/ui/bet_plate_blue / green / purple.png | 捕鱼 | HUD | `BetStepper` | 倍率板（数字程序绘制，按场次换色） | 🔧 |
| fishing/ui/frame_wide_fish / red / blue.png | 捕鱼 | 结算 / 预警 | `GamePopup` | Boss 击杀奖励 / 场次结算 | 🔧 |

## 4. 水果机（slots）

| 素材文件 | 游戏 | 界面 | 组件 | 功能 | 状态 |
| --- | --- | --- | --- | --- | --- |
| slots/symbols/slot_cherry.png | 水果机 | Reel | `ReelSymbol` | 符号 `CHERRY` | ✅ |
| slots/symbols/slot_lemon.png | 水果机 | Reel | `ReelSymbol` | `LEMON` | ✅ |
| slots/symbols/slot_orange.png | 水果机 | Reel | `ReelSymbol` | `ORANGE` | ✅ |
| slots/symbols/slot_grape.png | 水果机 | Reel | `ReelSymbol` | `GRAPE` | ✅ |
| slots/symbols/slot_watermelon.png | 水果机 | Reel | `ReelSymbol` | `MELON` | ✅ |
| slots/symbols/slot_diamond.png | 水果机 | Reel | `ReelSymbol` | `DIAMOND`（替代原 BELL 位） | ✅ |
| slots/symbols/slot_seven.png | 水果机 | Reel | `ReelSymbol` | `SEVEN` | ✅ |
| slots/symbols/slot_gold.png | 水果机 | Reel | `ReelSymbol` | `GOLD`（替代原 CROWN 位） | ✅ |
| slots/symbols/slot_wild.png | 水果机 | Reel | `ReelSymbol` | `WILD` 百搭 | ✅ |
| slots/symbols/slot_bonus.png | 水果机 | Reel | `ReelSymbol` | `BONUS`（原 SCATTER：免费旋转触发） | ✅ |
| slots/buttons/btn_spin.png | 水果机 | 控制台 | `SpinButton` | `spin()`（余额判定 → 扣费 → 服务端结果 → 停轮） | ✅ |
| slots/buttons/btn_max_bet.png | 水果机 | 控制台 | `GameButton art` | `maxBet()` | ✅ |
| slots/buttons/btn_auto.png | 水果机 | 控制台 | `GameButton art` | `toggleAuto()`（剩余次数程序绘制） | ✅ |
| slots/buttons/btn_turbo.png | 水果机 | 控制台 | `GameButton art` | `toggleTurbo()`（转轴动画加速） | ✅ |
| slots/buttons/btn_minus_blue.png / btn_plus_blue.png | 水果机 | 控制台 | `GameButton art` | `stepBet(±1)` | ✅ |
| slots/ui/total_bet_plate.png | 水果机 | 控制台 | `BetStepper` | 总投注板（数字程序绘制） | ✅ |
| slots/jackpot/jackpot_grand / major / minor / mini.png | 水果机 | 顶部 | `JackpotBar` | 四档奖池（金额实时推送 `slot.jackpot`，数字滚动） | ✅ |
| slots/ui/win_frame.png | 水果机 | 演出 | `WinBanner` | WIN 金额滚动 | ✅ |
| slots/character/caishen_ingot.png / caishen_round.png | 水果机 | 场景 / 大奖 | `SlotMascot` | 立绘、Jackpot 演出 | ✅ |

## 5. 轮盘（roulette）

| 素材文件 | 游戏 | 界面 | 组件 | 功能 | 状态 |
| --- | --- | --- | --- | --- | --- |
| roulette/table/table_layout.png | 轮盘 | GameScene | `RouletteTable` | 下注区底图，命中区域按坐标映射 → `placeBet(area)` | 🔧 |
| roulette/wheel/wheel_hero.png | 轮盘 | 大厅卡 / 待机 | `GameEntryCard` | 装饰（转动轮盘为程序绘制顶视图，停在服务端号码） | 🔧 |
| roulette/chips/roulette_chip_10 … _1m.png | 轮盘 | 筹码栏 | `BetChip` | `selectChip(n)`；落桌筹码飞行动画 | 🔧 |
| roulette/buttons/btn_spin.png | 轮盘 | 控制台 | `GameButton art` | `confirmBets()` 提交下注 → 服务端锁盘开奖 | 🔧 |
| roulette/buttons/btn_repeat.png | 轮盘 | 控制台 | `GameButton art` | `repeatLast()` | 🔧 |
| roulette/buttons/btn_close.png | 轮盘 | 控制台 | `GameButton art` | `clearBets()` | 🔧 |
| roulette/buttons/btn_auto.png | 轮盘 | 控制台 | `GameButton art` | `toggleAuto()`（自动重复上局） | 🔧 |
| common/buttons/btn_arrow_left.png | 轮盘 | 控制台 | `GameButton art` | `undoBet()` | 🔧 |
| roulette/ui/jackpot_banner.png | 轮盘 | 顶部 | `JackpotBar` | 幸运号码奖池（数字程序绘制） | 🔧 |
| roulette/character/caishen_ingot_splash.png / caishen_round.png | 轮盘 | 场景 / 大奖 | `Mascot` | 立绘 / 中奖演出 | 🔧 |

## 6. 股票涨跌（stock_game）

| 素材文件 | 游戏 | 界面 | 组件 | 功能 | 状态 |
| --- | --- | --- | --- | --- | --- |
| stock_game/buttons/btn_up_plate.png + icons/icon_bull.png | 股票 | GameScene | `UpButton` | `placeBet('UP')` | 🔧 |
| stock_game/buttons/btn_down_plate.png + icons/icon_bear.png | 股票 | GameScene | `DownButton` | `placeBet('DOWN')` | 🔧 |
| stock_game/icons/icon_arrow_up_green.png | 股票 | 更多投注 | `SideBetButton` | `placeBet('HIGHER')` | 🔧 |
| stock_game/icons/icon_arrow_down_red.png | 股票 | 更多投注 | `SideBetButton` | `placeBet('LOWER')` | 🔧 |
| stock_game/icons/icon_digit_first.png | 股票 | 更多投注 | `SideBetButton` | `placeBet('FIRST_DIGIT', d)` | 🔧 |
| stock_game/icons/icon_digit_last.png | 股票 | 更多投注 | `SideBetButton` | `placeBet('LAST_DIGIT', d)` | 🔧 |
| stock_game/chips/chip_10 … chip_10k.png | 股票 | 筹码栏 | `BetChip` | `selectChip(n)` | 🔧 |
| stock_game/character/caishen_scroll.png / caishen_analyst.png | 股票 | 场景 | `Mascot` | 立绘（结算胜利 / 分析师提示） | 🔧 |
| —（走势图、行情列表、开盘价表、区间弧） | 股票 | GameScene | `PriceChart`（Canvas） | 全部程序绘制，数据来自 `stock.price` 推送 | 🔧 |

## 7. 麻将（mahjong）

| 素材文件 | 游戏 | 界面 | 组件 | 功能 | 状态 |
| --- | --- | --- | --- | --- | --- |
| mahjong/tiles/*.svg（CC0 riichi） | 麻将 | 牌桌 | `MjTile` | 万 / 筒 / 条 / 风 / 箭 牌面 | ✅ |
| mahjong/effects/fx_hu.png | 麻将 | 演出 | `HuEffect` | `mahjong.hu` → 胡牌爆字 | ✅ |
| mahjong/effects/fx_big_win.png | 麻将 | 结算 | `RoundResultPopup` | 赢家大赢横幅 | ✅ |
| mahjong/ui/turn_pointer.png | 麻将 | 罗盘 | `TurnIndicator` | 指向当前出牌方 | ✅ |
| mahjong/character/caishen_fa_tile.png | 麻将 | 大厅卡 / 结算 | `GameEntryCard` / `RoundResultPopup` | 立绘 | ✅ |
| mahjong/buttons/btn_minus_orange.png / btn_plus_orange.png | 麻将 | 建房 | `BetStepper` | 底分 ± | 🔧 |
| mahjong/ui/bet_plate.png | 麻将 | 建房 | `BetStepper` | 底分板（数字程序绘制） | 🔧 |
| mahjong/ui/jackpot_banner.png | 麻将 | — | — | 装饰（麻将无奖池） | 📦 |
| common/popup/popup_cream_red.png | 麻将 | 结算 | `GamePopup` | 结算面板底框 | ✅ |
| —（吃 / 碰 / 杠 / 胡 / 过 按钮） | 麻将 | 操作栏 | `GameButton variant=gold/red/green` | `sendAction('peng'|'gang'|'hu'|'pass')` → 服务端校验 → 广播 | ✅ |

## 8. 红十（red10）

| 素材文件 | 游戏 | 界面 | 组件 | 功能 | 状态 |
| --- | --- | --- | --- | --- | --- |
| red10/cards/*.svg / *.webp（公共领域） | 红十 | 牌桌 | `PlayCard` | 52 张牌面 | ✅ |
| red10/cards/suit_heart / diamond / spade / club.png | 红十 | 身份 / 提示 | `IdentityBadge` | 红十身份（♥10 / ♦10）标志 | ✅ |
| red10/effects/fx_win.png | 红十 | 结算 | `RoundResultPopup` | 胜利演出 | ✅ |
| red10/effects/fx_x2.png / fx_x4.png | 红十 | 结算 | `MultiplierBadge` | 双上 ×2 / 独上 ×3(程序) / 上限 ×4 | ✅ |
| red10/effects/fx_bomb_zh.png | 红十 | 出牌演出 | `PlayCallout` | 打出炸弹（zh；ko 程序文字） | ✅ |
| red10/effects/fx_hongshi_zh.png | 红十 | 身份揭示 | `PlayCallout` | `hongshi.identityReveal` | ✅ |
| red10/effects/fx_pass_zh.png / fx_no_play_zh.png | 红十 | 出牌演出 | `PlayCallout` | `PlayCallout` | 不出：`fx_no_play_zh`（zh）/ 程序文字；`fx_pass_zh` 与之同义，留作备用 | ✅ |
| red10/ui/turn_arrow_zh.png | 红十 | 轮次 | `TurnIndicator` | 轮到我出牌（zh） | ✅ |
| red10/buttons/btn_ready_zh.png | 红十 | 等待 | `GameButton art(zh)` | `room.ready` | ✅ |
| red10/buttons/btn_start_zh.png | 红十 | 等待（房主） | `GameButton art(zh)` | `GameButton art(zh)` | 房间为准备即自动开局，无「开始游戏」动作，不接入 | 📦 |
| red10/buttons/btn_compare_zh.png | 红十 | 操作栏 | `GameButton art(zh)` | `GameButton art(zh)` | 烙字「比牌」与红十「出牌」语义不符；出牌按钮用 CSS 板件 + 程序文字 | 📦 |
| red10/buttons/btn_settle_zh.png | 红十 | 结算 | `GameButton art(zh)` | `GameButton art(zh)` | 结算面板收起后重新查看本局战绩 | ✅ |
| red10/ui/mode_icon_* + mode_plate_*.png | 红十 | 场次选择 | `StagePicker` | 经典场 / 比赛场 / 排位赛 / 好友房 / 创建房（文字程序绘制） | 🔧 |
| red10/buttons/btn_minus_gold.png / btn_plus_gold.png + ui/bet_plate.png | 红十 | 建房 | `BetStepper` | 底分 ± | 🔧 |
| red10/character/caishen_card.png | 红十 | 大厅卡 / 结算 | `GameEntryCard` / `RoundResultPopup` | 立绘 | ✅ |
| red10/ui/panel_result_zh.png | 红十 | 结算 | `RoundResultPopup` | `RoundResultPopup` | 面板烙有「本局战绩」标题，改用 `GamePopup skin=red` + 程序标题（双语） | 📦 |
| red10/ui/badge_master_zh.png | 红十 | 座位 | `IdentityBadge` | `IdentityBadge` | 「主牌」语义待与规则确认，不接入 | 📦 |
| lobby/banners/logo_red10.png | 红十 | 大厅 | `GameEntryCard` | Logo | 🔧 |

## 9. 明确不接入

| 素材 | 原因 |
| --- | --- |
| 股票 Sheet 的 Apple / Tesla / Microsoft / BTC / ETH Logo 与行情列表 | 真实商标；标的改为平台自有虚拟品种（程序绘制图标） |
| 各 Sheet 烙有玩家数据的 HUD 整条、积分榜、开盘价表、走势图 | 动态数据必须程序绘制 |
| 麻将 Sheet 的部分牌面（筒 / 条不全、无白板） | 套件不完整，继续使用 CC0 riichi 全套 |
| 轮盘透视轮盘图作为转动主体 | 透视图无法在 2D 中正确旋转；仅作装饰 |
| FIRST TOP-UP / CASHBACK 类充值语义 | 平台不做真实充值（虚拟资产约束） |
