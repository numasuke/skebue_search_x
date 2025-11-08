'use strict';

/**
 * プロフィールページの説明文下にSkebツイートの検索リンクを追加する。
 * SkebButton（Chrome拡張）の導入を前提とする
 */

//==============================================================
// defaults.jsから各.jsにコピー
const DEFAULTS = {
	searchKeywords: ["skeb", "skeb (二次創作 OR オリジナル)"]
};
//==============================================================

// ===============================
//  context 安全化レイヤー
// ===============================
let contextAlive = true;

// context が生きている時だけ実行する安全ラッパー
function safe(fn) {
	if (!contextAlive) return;
	try {
		fn();
	} catch (e) {
		// context が死んでいるとここに来る
		// console.warn("safe blocked:", e);
	}
}

// SPA がページ遷移する時に context が無効になる
window.addEventListener("pagehide", () => {
	contextAlive = false;
});
window.addEventListener("beforeunload", () => {
	contextAlive = false;
});
window.addEventListener("unload", () => {
	contextAlive = false;
});

// ===============================
// ストレージキャッシュ
// ===============================
let storageCashe = {
	searchKeywords: [],
};

// ストレージの初回ロード
chrome.storage.local.get(["searchKeywords"], (res) => {
	storageCashe.searchKeywords = res.searchKeywords || DEFAULTS.searchKeywords;
});

// ストレージ変更監視
chrome.storage.onChanged.addListener((changes, area) => {
	safe(() => {
		if (area === "local" && changes.searchKeywords) {
			storageCashe.searchKeywords = changes.searchKeywords.newValue || [];
			loadedInfo.userName = "";  // リンク再注入のためリセット

			// 変更反映
			safe(() => {
				insertTweetSearchLink();
			});
		}
	});
});

// ===============================
//  main処理// ===============================
let loading = false;

let loadedInfo = {
	userName: "",
	container: null,
}

//------------------------------
// ツイート検索リンクを挿入
//------------------------------
function insertTweetSearchLink() {

	if (loading) return;
	loading = true;

	try {

		// キーワード有無判定
		const keywords = storageCashe.searchKeywords;
		if (!Array.isArray(keywords) || keywords.length === 0) return;

		// 挿入可否判定
		const userName = getUserName();
		if(!canInsert(userName)) return;
		if(handleSameUserInsertion(userName)) return;

		// 挿入済みリンクを削除　※ユーザーが変わった時に残っている場合がある
		removeUeSearchContainer();

		// リンクコンテナ
		const container = document.createElement("div");
		container.className = "skeb-ue-search-container";

		// オプション
		const opt = createOptionsLink();
		container.appendChild(opt);

		// 検索リンク
		keywords.forEach(word => {
			const link = createUeSearchLink(userName, word);
			container.appendChild(link);
		});

		// プロフに追加
		insertLinkContainer(container);
		
		// 情報更新
		loadedInfo.userName = userName;
		loadedInfo.container = container;

	} finally {
		loading = false;
	}
}

//------------------------------
// オプション画面へのリンク作成（メッセージングに変更）
//------------------------------
function createOptionsLink() {
	
	const a = document.createElement("a");
	a.className = "skeb-ue-options-link"; // 任意のクラス名
	a.href = "#"; // リンク先は不要なので '#' に設定
	//a.textContent = `⚙️設定`; // 歯車アイコンとテキスト

	// 画像要素を作成
	const img = document.createElement("img");
	img.src = chrome.runtime.getURL("images/icon16.png"); 
	img.alt = "設定"; // 代替テキスト

	// aタグに画像を追加
	a.appendChild(img);

	// クリック時のイベントリスナーを追加
	a.addEventListener('click', (event) => {
		event.preventDefault(); // リンクのデフォルト動作（ページ遷移）を防止
		// バックグラウンドスクリプトに 'option' メッセージを送信
		chrome.runtime.sendMessage('option');
	});

	return a;
}

//------------------------------
// 挿入可否チェック
//------------------------------
function canInsert(userName) {

	// プロフィール取得
	const profile = getProfile();
	if (!profile) {
		//console.log("プロフィールページでなければ何もしない");
		return false;
	}

	// SkebButtonがなければボタン削除して終了
	const skebItems = profile.getElementsByClassName("skeb");
	if (skebItems.length === 0) {
		//console.log("SkebButtonがなければボタン削除して終了");
		removeUeSearchContainer();
		return false;
	}

	// ユーザー名
	//const userName = getUserName();
	if (!userName) {
		//console.log("まだ読み込まれていない場合");
		removeUeSearchContainer();
		return false; // まだ読み込まれていない場合
	}

	return true;
}

//------------------------------
// ユーザー変更確認
// 変更無ければリンクを再挿入の確認と実施
//------------------------------
function handleSameUserInsertion(userName) {

	// ユーザー名が前回と異なれば何もしない
	if (loadedInfo.userName !== userName) {
		return false;
	}

	// 古いリンクをできたら何もしない
	const oldLink = hasUeSearchContainer();

	// 保管したリンクがあれば再挿入
	if (!oldLink && loadedInfo.container) {
		insertLinkContainer(loadedInfo.container);
	}

	return true;
}

//------------------------------
// プロフィール取得
//------------------------------
function getProfile() {
	const profile = document.querySelector("[data-testid='UserProfileHeader_Items']");
	return profile;
}

//------------------------------
// ユーザー名（スクリーンネーム：@xxxx）を取得
//------------------------------
function getUserName() {

	// URLから取得
	const path = location.pathname.split("/");
	return path[1] || null;
}

//------------------------------
// 検索リンク作成
//------------------------------
function createUeSearchLink(userName, word) {

	// 検索URL from:$userName $word
	const url = "/search?q=" + encodeURIComponent(`from:${userName} (${word})`) + "&src=typed_query&f=live";

	const a = document.createElement("a");
	a.className = "skeb-ue-search-link";
	a.textContent = `💬${word}`;
	a.href = url;

	return a;
}

//------------------------------
// 検索リンク挿入
//------------------------------
function insertLinkContainer(node) {

	const profile = getProfile();
	const skebDiv = profile.querySelector("div.skeb");	// SkebButtonのdiv

	if (skebDiv) {
		// SkebButtonの後ろに追加
		//skebDiv.insertAdjacentHTML("afterend", node.outerHTML);
		skebDiv.insertAdjacentElement("afterend", node);
	} else {
		// profileの直下先頭に挿入
		//profile.insertAdjacentHTML("afterbegin", node.outerHTML);
		profile.insertAdjacentElement("afterbegin", node);
	}
}

//------------------------------
// 検索コンテナがあるか
//------------------------------
function hasUeSearchContainer() {
	const links = document.querySelectorAll('.skeb-ue-search-container');
	return links.length > 0;
}

//------------------------------
// 検索コンテナをすべて除去
//------------------------------
function removeUeSearchContainer() {
	const links = document.querySelectorAll('.skeb-ue-search-container');
	links.forEach(link => {
		if (link.parentNode) link.parentNode.removeChild(link);
	});
}

//------------------------------
// MutationObserver：SPA・再描画対策
//------------------------------
const observer = new MutationObserver(() => {
	safe(() => {
		insertTweetSearchLink();
	});
});

// X は全DOMが差し替わるため body 全体を監視
observer.observe(document.body, {childList: true,subtree: true});
