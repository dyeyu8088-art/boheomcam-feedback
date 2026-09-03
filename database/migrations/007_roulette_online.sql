-- 轮盘上线：服务端引擎 + 回合循环 + 客户端已完成（大厅入口按 games.status 显示）
UPDATE games SET status='online' WHERE game_id='roulette';
