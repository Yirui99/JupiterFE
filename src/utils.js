// If you don't want to host your server code and client code together, you can 
// pay AWS to host your server with HTTPS then config the api url endpoints like below
// const SERVER_ORIGIN = '<Your server's url>'; 
const SERVER_ORIGIN = '';
 
const loginUrl = `${SERVER_ORIGIN}/login`;

export const login = (credential) => {
  return fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(credential)
  }).then((response) => {
    if (response.status !== 200) {
      throw Error('Fail to log in');
    }
 
    return response.json();
  })
}
 
const registerUrl = `${SERVER_ORIGIN}/register`;
 
export const register = (data) => {
  return fetch(registerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  }).then((response) => {
    if (response.status !== 200) {
      throw Error('Fail to register');
    }
  })
}
 
const logoutUrl = `${SERVER_ORIGIN}/logout`;
 
export const logout = () => {
  return fetch(logoutUrl, {
    method: 'POST',
    credentials: 'include',
  }).then((response) => {
    if (response.status !== 200) {
      throw Error('Fail to log out');
    }
  })
}
 
const topGamesUrl = `${SERVER_ORIGIN}/game`;
 
export const getTopGames = () => {
  return fetch(topGamesUrl).then((response) => {
    if (response.status !== 200) {
      throw Error('Fail to get top games');
    }
 
    return response.json();
  })
}
 
const getGameDetailsUrl = `${SERVER_ORIGIN}/game?game_name=`;
 
const getGameDetails = (gameName) => {
  return fetch(`${getGameDetailsUrl}${gameName}`).then((response) => {
    if (response.status !== 200) {
      throw Error('Fail to find the game');
    }
 
    return response.json();
  });
}
 
const searchGameByIdUrl = `${SERVER_ORIGIN}/search?game_id=`;
 
export const searchGameById = (gameId) => {
  return fetch(`${searchGameByIdUrl}${gameId}`).then((response) => {
    if (response.status !== 200) {
      throw Error('Fail to find the game');
    }
    return response.json();
  })
}
 
// 单一类型的一页数据，返回 { items, cursor }。cursor 为空表示没有下一页。
// 不带 cursor 时后端可以走缓存，带 cursor 则实时请求 Twitch。
const searchPageUrl = `${SERVER_ORIGIN}/search/page`;

export const ITEM_TYPES = ['STREAM', 'VIDEO', 'CLIP'];

export const searchItemsPage = (gameId, type, cursor, limit = 21) => {
  const params = new URLSearchParams({ game_id: gameId, type, limit: String(limit) });

  if (cursor) {
    params.set('cursor', cursor);
  }

  return fetch(`${searchPageUrl}?${params.toString()}`).then((response) => {
    if (response.status !== 200) {
      throw Error('Fail to load more items');
    }

    return response.json();
  })
}

// 三种类型并行取第一页，返回 { STREAM: {items, cursor}, VIDEO: ..., CLIP: ... }
export const searchPagesByGameId = (gameId) => {
  return Promise.all(
    ITEM_TYPES.map((type) => searchItemsPage(gameId, type).then((page) => [type, page]))
  ).then((entries) => {
    const pages = {};
    entries.forEach(([type, page]) => {
      pages[type] = { items: page.items || [], cursor: page.cursor || null };
    });

    return pages;
  })
}

// 搜索按名字找到游戏后，把 gameId 一并返回，翻页时需要它
export const searchGameByName = (gameName) => {
  return getGameDetails(gameName).then((data) => {
    if (data && data.id) {
      return searchPagesByGameId(data.id).then((pages) => ({ gameId: data.id, pages }));
    }
 
    throw Error('Fail to find the game')
  })
}
 
const favoriteItemUrl = `${SERVER_ORIGIN}/favorite`;
 
export const addFavoriteItem = (favItem) => {
  return fetch(favoriteItemUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ favorite: favItem })
  }).then((response) => {
    if (response.status !== 200) {
      throw Error('Fail to add favorite item');
    }
  })
}
 
export const deleteFavoriteItem = (favItem) => {
  return fetch(favoriteItemUrl, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ favorite: favItem })
  }).then((response) => {
    if (response.status !== 200) {
      throw Error('Fail to delete favorite item');
    }
  })
}
 
export const getFavoriteItem = () => {
  return fetch(favoriteItemUrl, {
    credentials: 'include',
  }).then((response) => {
    if (response.status !== 200) {
      throw Error('Fail to get favorite item');
    }
 
    return response.json();
  })
}
 
const getRecommendedItemsUrl = `${SERVER_ORIGIN}/recommendation`;
 
export const getRecommendations = (page = 0) => {
  return fetch(`${getRecommendedItemsUrl}?page=${page}`, {
    credentials: 'include',
  }).then((response) => {
    if (response.status !== 200) {
      throw Error('Fail to get recommended item');
    }
 
    return response.json();
  })
}


