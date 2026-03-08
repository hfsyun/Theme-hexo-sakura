---
title: SaySupabase食用指南
urlname: weste0exor7cdwwg
date: '2026-03-09 00:00:00 +0800'
categories:
  - Hexo
tags:
  - Hexo
  - Supabase
  - 数据库
  - 前端开发
---

## 概述

本文档详细说明如何使用 Supabase 平台搭建一个在 Hexo 下能支持用户登录、发布说说、实时更新等说说的功能。起因是因为 LeanCloud 到 2027 年 1 月停止使用了，就想到把说说从 LeanCloud 迁移到 Supabase 中

![](https://cdn.nlark.com/yuque/0/2026/webp/639141/1772952507547-9d11817d-b04c-4bf3-ba9a-bee0778ea2bf.webp)

### 核心功能

- 用户登录（基于 Supabase Auth）
- 发布、编辑、删除说说
- 实时数据同步（WebSocket）
- 行级安全策略（RLS）

## 第一步：创建 Supabase 项目

### 1.1 访问控制台

注册成功后会收到确认邮件，点击链接后可以看到项目控制台，访问 [Supabase Dashboard](https://supabase.com/dashboard)，其他默认只需修改数据库密码和区域

![](https://cdn.nlark.com/yuque/0/2026/jpeg/639141/1772952845257-eaaf8f05-093b-4515-8a17-efc7bf34f0bd.jpeg)

![](https://cdn.nlark.com/yuque/0/2026/jpeg/639141/1772952852601-057d401d-bece-4862-894b-40eb64901243.jpeg)

### 1.2 填写项目信息

- **Name**: 项目名称，如 my-say-system
- **Database Password**: 数据库密码（用不到）
- **Region**: 选择离你最近的区域

### 1.3 记录关键信息

项目创建完成后，进入 Project Settings API 页面，记录以下信息：

- supabaseUrl: Data Api-API URL
- anon public key/supabaseAnonKey：API Keys-Publishable key

> **重要提示**：anon key 是公开密钥，可以在前端安全使用。service_role key 具有完全权限，切勿暴露在前端代码中。

## 第二步：数据库初始化

### 2.1 打开 SQL Editor

在 Supabase Dashboard 左侧菜单中，点击 SQL Editor，然后点击 New query 创建新查询。

### 2.2 执行初始化脚本

按照以下顺序依次执行三个 SQL 脚本。

#### 脚本一：创建表结构和 RLS 策略

```sql
-- =====================================================
-- Supabase 数据库迁移脚本
-- =====================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. 用户表 (使用 Supabase Auth，创建扩展表)
-- =====================================================

-- 用户扩展信息表
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  avatar TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户名索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- 自动创建用户配置的触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, username)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除已存在的触发器（如果有）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建触发器
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 2. 说说表 (Say)
-- =====================================================

CREATE TABLE IF NOT EXISTS says (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  username VARCHAR(50) NOT NULL,
  avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_says_created_at ON says(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_says_author_id ON says(author_id);

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_says_updated_at
    BEFORE UPDATE ON says
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. Row Level Security (RLS) 策略
-- =====================================================

-- 启用 RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE says ENABLE ROW LEVEL SECURITY;

-- 用户配置表策略
CREATE POLICY "用户可以查看所有用户配置" ON user_profiles
    FOR SELECT USING (true);

CREATE POLICY "用户只能更新自己的配置" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- 说说表策略
CREATE POLICY "所有人可以查看说说" ON says
    FOR SELECT USING (true);

CREATE POLICY "登录用户可以创建说说" ON says
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "作者可以更新自己的说说" ON says
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "作者可以删除自己的说说" ON says
    FOR DELETE USING (auth.uid() = author_id);

-- =====================================================
-- 4. 存储桶配置 (用于文件上传)
-- =====================================================

-- 创建头像存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 删除已存在的存储桶策略（如果有）
DROP POLICY IF EXISTS "所有人可以查看头像" ON storage.objects;
DROP POLICY IF EXISTS "登录用户可以上传头像" ON storage.objects;
DROP POLICY IF EXISTS "用户可以更新自己的头像" ON storage.objects;

-- 存储桶策略
CREATE POLICY "所有人可以查看头像" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "登录用户可以上传头像" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "用户可以更新自己的头像" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- 5. 实时订阅配置
-- =====================================================

-- 为实时功能添加副本标识
ALTER TABLE says REPLICA IDENTITY FULL;

-- =====================================================
-- 6. 视图
-- =====================================================

-- 获取说说列表（包含作者信息）
CREATE OR REPLACE VIEW says_with_author AS
SELECT
    s.id,
    s.content,
    s.author_id,
    s.created_at,
    s.updated_at,
    COALESCE(s.username, up.username) as username,
    COALESCE(s.avatar, up.avatar) as avatar
FROM says s
LEFT JOIN user_profiles up ON s.author_id = up.id
ORDER BY s.created_at DESC;

```

#### 脚本二：创建数据库函数

```sql
-- =====================================================
-- 补充数据库函数和触发器
-- =====================================================

-- 获取说说列表函数
CREATE OR REPLACE FUNCTION get_says(
    page_offset INTEGER DEFAULT 0,
    page_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    author_id UUID,
    username VARCHAR(50),
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.content,
        s.author_id,
        s.username,
        s.avatar,
        s.created_at,
        s.updated_at
    FROM says s
    ORDER BY s.created_at DESC
    OFFSET page_offset
    LIMIT page_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 用户统计函数
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_says', (SELECT COUNT(*) FROM says WHERE author_id = user_uuid)
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 搜索说说函数
CREATE OR REPLACE FUNCTION search_says(
    search_query TEXT,
    page_offset INTEGER DEFAULT 0,
    page_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    author_id UUID,
    username VARCHAR(50),
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.content,
        s.author_id,
        s.username,
        s.avatar,
        s.created_at,
        s.updated_at
    FROM says s
    WHERE
        s.content ILIKE '%' || search_query || '%' OR
        s.username ILIKE '%' || search_query || '%'
    ORDER BY s.created_at DESC
    OFFSET page_offset
    LIMIT page_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 批量获取说说
CREATE OR REPLACE FUNCTION get_says_by_ids(
    ids UUID[]
)
RETURNS SETOF says AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM says
    WHERE id = ANY(ids)
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理过期会话（可选）
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS VOID AS $$
BEGIN
    DELETE FROM auth.sessions
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新用户头像
CREATE OR REPLACE FUNCTION update_user_avatar(
    user_uuid UUID,
    new_avatar TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles
    SET avatar = new_avatar,
        updated_at = NOW()
    WHERE id = user_uuid;

    UPDATE says
    SET avatar = new_avatar
    WHERE author_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

```

#### 脚本三：创建管理员账户

> **重要**：执行前请修改脚本中的邮箱、密码、用户名和头像链接！，在 84-113 行

```sql
-- =====================================================
-- 数据迁移脚本
-- =====================================================

-- 注意：此脚本需要在Supabase SQL Editor中执行
-- =====================================================
-- 第一步：创建用户函数
-- =====================================================

-- 创建用户函数（返回用户ID）
DROP FUNCTION IF EXISTS create_migration_user(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_migration_user(
    user_email TEXT,
    user_password TEXT,
    user_username TEXT,
    user_avatar TEXT
) RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
    existing_user_id UUID;
BEGIN
    SELECT id INTO existing_user_id
    FROM auth.users
    WHERE email = user_email;

    IF existing_user_id IS NOT NULL THEN
        INSERT INTO user_profiles (id, username, avatar)
        VALUES (existing_user_id, user_username, user_avatar)
        ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            avatar = EXCLUDED.avatar;

        RETURN existing_user_id;
    END IF;

    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        uuid_generate_v4(),
        'authenticated',
        'authenticated',
        user_email,
        crypt(user_password, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        json_build_object('username', user_username),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ) RETURNING id INTO new_user_id;

    INSERT INTO user_profiles (id, username, avatar)
    VALUES (new_user_id, user_username, user_avatar)
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        avatar = EXCLUDED.avatar;

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 第二步：执行迁移
-- =====================================================

DO $$
DECLARE
    new_id UUID;
BEGIN
    -- 创建用户：
    new_id := create_migration_user(
        'hfsyun@aliyun.com', --注册邮箱
        'pass11111111', --前端说说的密码
        'hfsyun', --前端说说的登录用户名
        'https://i0.hdslb.com/bfs/article/318bbf54f45140411e981ed6ce80867244104643.jpg' --前端说说的头像
    );

    RAISE NOTICE '用户创建成功，新ID: %', new_id;
END $$;

-- =====================================================
-- 第三步：插入说说数据
-- =====================================================

INSERT INTO says (content, author_id, username, avatar, created_at, updated_at)
SELECT
    '<p>欢迎来到说说世界！这是我的第一条说说，记录生活的点滴美好。</p>',
    u.id,
    'hfsyun',
    'https://i0.hdslb.com/bfs/article/318bbf54f45140411e981ed6ce80867244104643.jpg',
    NOW(),
    NOW()
FROM auth.users u
WHERE u.email = 'hfsyun@aliyun.com';

-- =====================================================
-- 第四步：验证迁移结果
-- =====================================================

-- 查看迁移的用户
SELECT
    u.id,
    u.email,
    p.username,
    p.avatar
FROM auth.users u
JOIN user_profiles p ON u.id = p.id;

-- 查看迁移的说说数量
SELECT COUNT(*) as total_says FROM says;

-- 查看最新的说说
SELECT
    s.id,
    s.content,
    s.username,
    s.created_at
FROM says s
ORDER BY s.created_at DESC
LIMIT 5;

```

### 2.3 验证执行结果

执行完所有脚本后，在左侧菜单中点击 Table Editor，应该能看到以下表：

- user_profiles - 用户配置表（可以修改用户和头像）
- says - 说说表

## 第三步：前端集成

### 3.1 在页面中引入

```html
<link
  href="https://fastly.jsdelivr.net/gh/hfsyun/cdn@b48412b/css/say.min.css"
  rel="stylesheet"
  type="text/css"
/>
<script
  type="text/javascript"
  src="https://fastly.jsdelivr.net/npm/@supabase/supabase-js@2.98.0/dist/umd/supabase.js"
></script>
<script type="text/javascript" src="/js/supabase-client.js"></script>
<script
  type="text/javascript"
  src="https://fastly.jsdelivr.net/gh/hfsyun/cdn@55992f8/js/Say3.min.js"
></script>

<div id="atk-say"></div>

<script type="text/javascript">
  document.addEventListener("DOMContentLoaded", () => {
    new Say({
      supabaseUrl: "https://xxxxxxxxxxxxx.supabase.co",
      supabaseAnonKey: "JtaOqoOq",
      pageSize: 10,
      loadImg: loadImg,
    });
  });
</script>
```

### 3.2 添加 supabase-client.js

修改自己注册邮箱后缀在 112 和 142，不然不能登录说说

```javascript
"use strict";

class SupabaseClient {
  constructor(options) {
    if (!options || !options.supabaseUrl || !options.supabaseAnonKey) {
      throw new Error(
        "缺少必要的配置参数：supabaseUrl 和 supabaseAnonKey 必须提供"
      );
    }

    this.supabaseUrl = options.supabaseUrl;
    this.supabaseAnonKey = options.supabaseAnonKey;
    this.client = null;
    this.currentUser = null;
    this.authStateListeners = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    if (typeof window.supabase === "undefined") {
      throw new Error("Supabase SDK 未加载，请确保引入 @supabase/supabase-js");
    }

    this.client = window.supabase.createClient(
      this.supabaseUrl,
      this.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    );

    const {
      data: { session },
    } = await this.client.auth.getSession();
    if (session) {
      this.currentUser = session.user;
      await this.loadUserProfile();
    }

    this.client.auth.onAuthStateChange(async (event, session) => {
      this.currentUser = session?.user || null;

      if (event === "SIGNED_IN" && this.currentUser) {
        await this.loadUserProfile();
      }

      this.authStateListeners.forEach((cb) => cb(this.currentUser, event));
    });

    this.initialized = true;
  }

  async loadUserProfile() {
    if (!this.currentUser) return null;

    const { data, error } = await this.client
      .from("user_profiles")
      .select("*")
      .eq("id", this.currentUser.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("加载用户配置失败:", error);
      return null;
    }

    if (data) {
      this.userProfile = data;
      return data;
    }

    const { data: newProfile, error: createError } = await this.client
      .from("user_profiles")
      .insert({
        id: this.currentUser.id,
        username: this.currentUser.email?.split("@")[0] || `user_${Date.now()}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.currentUser.id}`,
      })
      .select()
      .single();

    if (createError) {
      console.error("创建用户配置失败:", createError);
      return null;
    }

    this.userProfile = newProfile;
    return newProfile;
  }

  onAuthStateChange(callback) {
    this.authStateListeners.push(callback);
    return () => {
      this.authStateListeners = this.authStateListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getUserProfile() {
    return this.userProfile;
  }

  async signUp(username, password) {
    const { data, error } = await this.client.auth.signUp({
      email: `${username}@outlook.com`,
      password: password,
      options: {
        data: {
          username: username,
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await this.client
        .from("user_profiles")
        .upsert({
          id: data.user.id,
          username: username,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.id}`,
        });

      if (profileError) {
        console.error("创建用户配置失败:", profileError);
      }
    }

    return data;
  }

  async signIn(username, password) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: `${username}@outlook.com`,
      password: password,
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
    this.currentUser = null;
    this.userProfile = null;
  }

  async createSay(content) {
    if (!this.currentUser || !this.userProfile) {
      throw new Error("用户未登录");
    }

    const { data, error } = await this.client
      .from("says")
      .insert({
        content: content,
        author_id: this.currentUser.id,
        username: this.userProfile.username,
        avatar: this.userProfile.avatar,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateSay(sayId, content) {
    if (!this.currentUser) {
      throw new Error("用户未登录");
    }

    const { data, error } = await this.client
      .from("says")
      .update({ content: content })
      .eq("id", sayId)
      .eq("author_id", this.currentUser.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteSay(sayId) {
    if (!this.currentUser) {
      throw new Error("用户未登录");
    }

    const { error } = await this.client
      .from("says")
      .delete()
      .eq("id", sayId)
      .eq("author_id", this.currentUser.id);

    if (error) throw error;
  }

  async getSays(page = 0, pageSize = 10) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await this.client
      .from("says")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      data: data,
      total: count,
      hasMore: count > (page + 1) * pageSize,
    };
  }

  async getSayById(sayId) {
    const { data, error } = await this.client
      .from("says")
      .select("*")
      .eq("id", sayId)
      .single();

    if (error) throw error;
    return data;
  }

  subscribeToSays(callback) {
    const channel = this.client
      .channel("says-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "says",
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return () => {
      this.client.removeChannel(channel);
    };
  }

  async uploadAvatar(file) {
    if (!this.currentUser) {
      throw new Error("用户未登录");
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${this.currentUser.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await this.client.storage
      .from("avatars")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = this.client.storage.from("avatars").getPublicUrl(fileName);

    const { error: updateError } = await this.client
      .from("user_profiles")
      .update({ avatar: publicUrl })
      .eq("id", this.currentUser.id);

    if (updateError) throw updateError;

    this.userProfile.avatar = publicUrl;
    return publicUrl;
  }

  getClient() {
    return this.client;
  }
}

window.SupabaseClient = SupabaseClient;
```
