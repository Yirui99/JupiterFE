import React from 'react';
import { Button, Col, Drawer, Layout, Menu, message, Row } from 'antd';
import Login from './components/Login';
import Register from './components/Register';
import { getFavoriteItem, getRecommendations, getTopGames, ITEM_TYPES, logout, searchItemsPage, searchPagesByGameId } from './utils';
import Favorites from './components/Favorites';
import { LikeOutlined, FireOutlined, MenuOutlined } from '@ant-design/icons';
import CustomSearch from './components/CustomSearch';
import SubMenu from 'antd/lib/menu/SubMenu';
import Home from './components/Home';
 
const { Header, Content } = Layout;

// cursor 是一个不透明的「下一页」标记：浏览游戏时是 Twitch 的游标，
// 看推荐时是下一页的页码。空数组表示这一类型已经没有更多了。
const toPages = (data, nextPage) => {
  const pages = {};
  ITEM_TYPES.forEach((type) => {
    const items = (data && data[type]) || [];
    pages[type] = { items, cursor: items.length > 0 ? String(nextPage) : null };
  });

  return pages;
}
 
class App extends React.Component {
  state = {
    drawerVisible: false,
    loggedIn: false,
    topGames: [],
    // 当前浏览的游戏。推荐列表没有对应的游戏，Twitch 也无法对它翻页，此时为 null
    gameId: null,
    // 推荐列表当前已加载到第几页
    recPage: 0,
    // 每种类型各自持有 items 和下一页游标
    pages: {
      STREAM: { items: [], cursor: null },
      VIDEO: { items: [], cursor: null },
      CLIP: { items: [], cursor: null },
    },
    favoriteItems: {
      VIDEO: [],
      STREAM: [],
      CLIP: [],
    },
  }
 
  favoriteOnChange = () => {
    getFavoriteItem().then((data) => {
      this.setState({
        favoriteItems: data,
        loggedIn: true
      })
    }).catch((err) => {
      message.error(err.message);
    })
  }
 
  onGameSelect = ({ key }) => {
    // 移动端选完就把浮层收起，否则会一直挡着内容
    this.setState({ drawerVisible: false });

    if (key === 'Recommendation') {
      getRecommendations(0)
        .then((data) => {
          this.setState({ gameId: null, recPage: 0, pages: toPages(data, 1) })
        })
        .catch((err) => message.error(err.message));

      return;
    }

    searchPagesByGameId(key)
      .then((pages) => {
        this.setState({ gameId: key, pages })
      })
      .catch((err) => message.error(err.message));
  }
 
  customSearchOnSuccess = ({ gameId, pages }) => {
    this.setState({ gameId, pages })
  }

  // 把一页新数据按类型合并进已有列表，重复的条目丢掉
  appendItems = (type, incoming, nextCursor, guard) => {
    this.setState((prev) => {
      if (!guard(prev)) {
        return null;
      }

      const seen = new Set(prev.pages[type].items.map((item) => item.id));
      const fresh = (incoming || []).filter((item) => !seen.has(item.id));

      return {
        pages: {
          ...prev.pages,
          [type]: {
            items: prev.pages[type].items.concat(fresh),
            cursor: nextCursor,
          },
        },
      }
    })
  }

  // 推荐列表没有 Twitch 游标，靠页码翻页；一次请求会同时推进三个标签页
  loadMoreRecommendations = (type) => {
    const { recPage, pages } = this.state;

    if (!pages[type].cursor) {
      return Promise.resolve();
    }

    const nextPage = recPage + 1;

    return getRecommendations(nextPage)
      .then((data) => {
        this.setState((prev) => (prev.gameId === null && prev.recPage === recPage ? { recPage: nextPage } : null));

        ITEM_TYPES.forEach((itemType) => {
          const incoming = data[itemType] || [];
          this.appendItems(
            itemType,
            incoming,
            incoming.length > 0 ? String(nextPage + 1) : null,
            (prev) => prev.gameId === null
          );
        });
      })
      .catch((err) => message.error(err.message));
  }

  // 滚动到底时追加下一页
  loadMore = (type) => {
    const { gameId, pages } = this.state;
    const page = pages[type];

    if (!page || !page.cursor) {
      return Promise.resolve();
    }

    if (!gameId) {
      return this.loadMoreRecommendations(type);
    }

    return searchItemsPage(gameId, type, page.cursor)
      .then((next) => {
        // 直播按实时观看人数排序，翻页期间名次会变，同一条目可能跨页重复出现。
        // guard 用来丢弃用户切走之后才返回的过期响应。
        this.appendItems(
          type,
          next.items,
          next.cursor || null,
          (prev) => prev.gameId === gameId && prev.pages[type].cursor === page.cursor
        );
      })
      .catch((err) => message.error(err.message));
  }
 
  signinOnSuccess = () => {
    getFavoriteItem().then((data) => {
      this.setState({
        favoriteItems: data,
        loggedIn: true
      })
    }).catch((err) => {
      message.error(err.message);
    })
  }
 
  signoutOnClick = () => {
    logout()
      .then(() => {
        this.setState({
          loggedIn: false
        })
        message.success(`Successfull signed out`);
      })
      .catch((err) => {
        message.error(err.message);
      })
  }
 
  componentDidMount = () => {
    getTopGames()
      .then((data) => {
        this.setState({
          topGames: data
        })
      })
      .catch((err) => {
        message.error(err.message);
      })

    // 首屏直接填上推荐内容。未登录时后端会返回基于热门游戏的默认推荐，
    // 所以不用等用户先点一个游戏，落地页就有直播和视频可看。
    getRecommendations(0)
      .then((data) => {
        this.setState({ pages: toPages(data, 1) })
      })
      .catch((err) => {
        message.error(err.message);
      })
  }
 
  // 抽屉里的侧边栏内容
  renderSideContent = () => (
    <>
      <CustomSearch onSuccess={this.customSearchOnSuccess} />
      <Menu
        mode="inline"
        onSelect={this.onGameSelect}
        style={{ marginTop: '10px' }}
      >
        <Menu.Item icon={<LikeOutlined />} key="Recommendation">
          Recommend for you!</Menu.Item>
        <SubMenu icon={<FireOutlined />} key="Popular Games" title="Popular Games" className="site-top-game-list">
          {
            this.state.topGames.map((game) => {
              return (
                <Menu.Item key={game.id} style={{ height: '50px' }}>
                  <img
                    alt="Placeholder"
                    src={game.box_art_url.replace('{height}', '40').replace('{width}', '40')}
                    style={{ borderRadius: '50%', marginRight: '20px' }}
                  />
                  <span>
                    {game.name}
                  </span>
                </Menu.Item>
              )
            })
          }
        </SubMenu>
      </Menu>
    </>
  )

  render = () => (
    <Layout>
      <Header>
        <Row justify="space-between" align="middle">
            <Col>
              <Button
                className="site-menu-trigger"
                type="text"
                icon={<MenuOutlined />}
                onClick={() => this.setState({ drawerVisible: true })}
              />
              <span className="site-brand">Jupiter</span>
              {
                this.state.loggedIn &&
                <Favorites data={this.state.favoriteItems} />
              }
            </Col>
            <Col>
              {
                this.state.loggedIn ?
                <Button shape="round" onClick={this.signoutOnClick}>
                  Logout</Button> :
                (
                  <>
                    <Login onSuccess={this.signinOnSuccess} />
                    <Register />
                  </>
                )
              }
            </Col>
          </Row>
      </Header>
      <Layout>
        {/* 桌面端和移动端统一用浮层抽屉，内容区始终占满宽度 */}
        <Drawer
          className="site-menu-drawer"
          placement="left"
          width={300}
          closable={false}
          bodyStyle={{ padding: 0 }}
          visible={this.state.drawerVisible}
          onClose={() => this.setState({ drawerVisible: false })}
        >
          {this.renderSideContent()}
        </Drawer>
        <Layout className="site-content-layout">
          <Content
            className="site-layout-background"
            style={{
              padding: 24,
              margin: 0,
              minHeight: 'calc(100vh - 112px)'
            }}
          >
            <Home
              pages={this.state.pages}
              onLoadMore={this.loadMore}
              loggedIn={this.state.loggedIn}
              favoriteItems={this.state.favoriteItems}
              favoriteOnChange={this.favoriteOnChange}
            />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}

export default App;