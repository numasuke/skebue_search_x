//==============================================================
// defaults.jsから各.jsにコピー
const DEFAULTS = {
	searchKeywords: ["skeb", "skeb (二次創作 OR オリジナル)"]
};
//==============================================================

// ページ読み込み時に復元
document.addEventListener("DOMContentLoaded", () => {
	chrome.storage.local.get({ searchKeywords: DEFAULTS.searchKeywords }, (data) => {
		const keywords = data.searchKeywords || [];
		const inputs = document.querySelectorAll(".kw");

		keywords.forEach((kw, i) => {
			if (inputs[i]) inputs[i].value = kw;
		});
	});
});

// 保存ボタン
document.getElementById("save").addEventListener("click", () => {
	const inputs = document.querySelectorAll(".kw");

	const keywords = Array.from(inputs)
		.map(i => i.value.trim())
		.filter(v => v !== ""); // 空欄を除外

	// 全部空欄 → storage の searchKeywords を削除
	if (keywords.length === 0) {
		chrome.storage.local.remove("searchKeywords", () => {
			showStatus("保存しました（再読み込みでデフォルトに戻ります）", 5000);
		});
		return;
	}

	// 1つ以上入力 → 保存
	chrome.storage.local.set({ searchKeywords: keywords }, () => {
		showStatus("保存しました", 5000);
	});
});

// リセットボタン
document.getElementById("reset").addEventListener("click", () => {

	const inputs = document.querySelectorAll(".kw");
	const keywords = DEFAULTS.searchKeywords;

	// まず全部空にする
	inputs.forEach(i => i.value = "");

	// デフォルト値だけセット
	keywords.forEach((kw, i) => {
		if (inputs[i]) inputs[i].value = kw;
	});
	
	showStatus("リセットしました　保存してください");
});

function showStatus(text, time) {
	const st = document.getElementById("status");
	st.textContent = text;
	
	if(time) setTimeout(() => (st.textContent = ""), 5000);
	
}