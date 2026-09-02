import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, message, Spin, Tabs, Tooltip } from 'antd';
import { StarOutlined, StarFilled } from '@ant-design/icons';
import { addFavoriteItem, deleteFavoriteItem } from '../utils';

const { TabPane } = Tabs;
const tabKeys = {
  Streams: 'stream',
  Videos: 'videos',
  Clips: 'clips',
}

// Twitch 对缩略图尚未生成的录像会返回一个 404_processing 占位地址，
// 而那个地址本身现在返回 403，直接渲染就是一张裂图。用本地占位图兜底。
const THUMBNAIL_FALLBACK =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
      '<rect width="640" height="360" fill="#e5e5e5"/>' +
      '<text x="320" y="180" text-anchor="middle" dominant-baseline="middle" ' +
      'font-family="sans-serif" font-size="16" fill="#9a9a9a">No preview available</text>' +
    '</svg>'
  );

const processUrl = (url) => {
  if (!url || url.includes('404_processing')) {
    return THUMBNAIL_FALLBACK;
  }

  return url
    .replace('%{height}', '360')
    .replace('%{width}', '640')
    .replace('{height}', '360')
    .replace('{width}', '640');
};

const VideoCard = ({ item, loggedIn, favs, favOnChange }) => {
  const isFav = favs.find((fav) => fav.id === item.id);

  const favOnClick = () => {
    const action = isFav ? deleteFavoriteItem : addFavoriteItem;

    action(item)
      .then(() => favOnChange())
      .catch((err) => message.error(err.message));
  }

  return (
    <div className="video-card">
      <a
        className="video-thumb"
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          alt={item.title}
          src={processUrl(item.thumbnail_url)}
          loading="lazy"
          onError={(e) => {
            // 兜住其他失效的缩略图，同时避免占位图本身再次触发 onError 造成死循环
            if (e.target.src !== THUMBNAIL_FALLBACK) {
              e.target.src = THUMBNAIL_FALLBACK;
            }
          }}
        />
      </a>
      <div className="video-meta">
        <div className="video-text">
          <a
            className="video-title"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title={item.title}
          >
            {item.title}
          </a>
          <div className="video-channel">{item.broadcaster_name}</div>
        </div>
        {
          loggedIn &&
          <Tooltip title={isFav ? 'Remove from favorite list' : 'Add to favorite list'}>
            <Button
              className="video-fav"
              type="text"
              shape="circle"
              icon={isFav ? <StarFilled /> : <StarOutlined />}
              onClick={favOnClick}
            />
          </Tooltip>
        }
      </div>
    </div>
  )
}

// 一个标签页的内容：网格 + 底部哨兵，哨兵进入视口就加载下一页
const InfiniteGrid = ({ type, page, loggedIn, favs, favOnChange, onLoadMore }) => {
  const sentinel = useRef(null);
  const grid = useRef(null);
  // 用 ref 做并发闸门，state 只负责渲染加载指示器
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  // 当前网格实际排了几列。列数由 auto-fill 决定，随容器宽度变化，只能实测
  const [columns, setColumns] = useState(1);
  // cursor 是统一的「还有下一页」标记，推荐视图没有 gameId 但同样可以翻页
  const hasMore = Boolean(page.cursor);
  // page.items 为空时 || [] 每次都会产生新数组，包一层避免 useMemo 依赖每次都变
  const items = useMemo(() => page.items || [], [page.items]);
  const count = items.length;

  useLayoutEffect(() => {
    const node = grid.current;

    if (!node) {
      return undefined;
    }

    const measure = () => {
      // 计算样式里会展开成实际的轨道列表，如 "441px 441px 441px 441px"
      const tracks = window.getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean);
      setColumns(tracks.length || 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [count]);

  // 只渲染能把最后一行填满的部分，余数留到下一页加载后再补齐。
  // 已经没有下一页时就全部显示，否则这些条目会被永久藏起来。
  const visible = useMemo(() => {
    if (!hasMore || count < columns) {
      return items;
    }

    return items.slice(0, Math.floor(count / columns) * columns);
  }, [items, count, columns, hasMore]);

  const loadMore = useCallback(() => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    Promise.resolve(onLoadMore(type)).finally(() => {
      loadingRef.current = false;
      setLoading(false);
    });
  }, [onLoadMore, type]);

  useEffect(() => {
    const node = sentinel.current;

    if (!node || !hasMore) {
      return undefined;
    }

    // 提前 600px 触发，滚到底之前内容就已经补上了
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
    // count 参与依赖：每追加一页就重新绑定观察器，
    // 否则首次渲染列表还是空的（哨兵未挂载），之后依赖不变就再也不会绑定
  }, [hasMore, loadMore, count]);

  if (count === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />;
  }

  return (
    <>
      <div className="video-grid" ref={grid}>
        {
          visible.map((item) => (
            <VideoCard
              key={item.id}
              item={item}
              loggedIn={loggedIn}
              favs={favs}
              favOnChange={favOnChange}
            />
          ))
        }
      </div>
      <div ref={sentinel} className="video-sentinel">
        {loading && <Spin />}
        {!hasMore && <span className="video-end">No more results</span>}
      </div>
    </>
  )
}

const Home = ({ pages, onLoadMore, loggedIn, favoriteItems, favoriteOnChange }) => {
  const { VIDEO: favVideos, STREAM: favStreams, CLIP: favClips } = favoriteItems;
  const favsByType = { STREAM: favStreams, VIDEO: favVideos, CLIP: favClips };
  const tabs = [
    ['Streams', tabKeys.Streams, 'STREAM'],
    ['Videos', tabKeys.Videos, 'VIDEO'],
    ['Clips', tabKeys.Clips, 'CLIP'],
  ];

  return (
    <Tabs defaultActiveKey={tabKeys.Streams} className="video-tabs">
      {
        tabs.map(([label, key, type]) => (
          <TabPane tab={label} key={key} forceRender={true}>
            <InfiniteGrid
              type={type}
              page={pages[type]}
              loggedIn={loggedIn}
              favs={favsByType[type]}
              favOnChange={favoriteOnChange}
              onLoadMore={onLoadMore}
            />
          </TabPane>
        ))
      }
    </Tabs>
  );
}

export default Home;
