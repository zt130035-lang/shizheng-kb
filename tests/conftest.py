# -*- coding: utf-8 -*-
"""pytest 全局钩子。

server.py 启动时会把 data/review_cache.json 里未过期的批改缓存加载进内存,
测试若命中上次运行残留的缓存,会绕过被 patch 的 call_deepseek 导致断言失败
(如 test_full_review_pipeline 里的 mock 未被调用)。这里每个用例开始前清空
内存缓存,保证测试与磁盘残留状态无关。
"""

import server


def pytest_runtest_setup(item):
    with server._REVIEW_CACHE_LOCK:
        server._REVIEW_CACHE.clear()