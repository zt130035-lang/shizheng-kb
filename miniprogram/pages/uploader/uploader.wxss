<view class="container">
  <view class="hero essay-hero">
    <view class="hero-title">申论批改</view>
    <view class="hero-subtitle">上传真题和答案，按题评分并修改。</view>
  </view>

  <view class="mode-switch kind-switch">
    <button class="mode-option {{reviewKind=='full'?'active':''}}" data-kind="full" bindtap="setReviewKind" disabled="{{reviewing}}">整套</button>
    <button class="mode-option {{reviewKind=='image'?'active':''}}" data-kind="image" bindtap="setReviewKind" disabled="{{reviewing}}">作文图片</button>
  </view>

  <block wx:if="{{reviewKind=='full'}}">
    <view class="section card">
      <view class="section-title">历年真题</view>
      <view class="card-meta">支持相册图片、拍照、聊天文件或粘贴文本。PDF/Word 请先发到文件传输助手。</view>
      <view class="divider"></view>
      <input class="input" placeholder="考试名称（可选）" value="{{paperTitle}}" bindinput="onPaperTitleInput" disabled="{{reviewing}}" />
      <button class="btn secondary file-btn" bindtap="choosePaperFile" disabled="{{reviewing}}">选择材料</button>
      <view wx:if="{{paperFileName}}" class="file-name">已选：{{paperFileName}}</view>
      <view wx:if="{{materialImages.length}}" class="answer-image-meta">已选 {{materialImages.length}} 张材料图，按顺序识别。</view>
      <view wx:if="{{materialImages.length}}" class="answer-image-list">
        <view class="answer-image-item" wx:for="{{materialImages}}" wx:key="path">
          <image class="answer-image-preview" src="{{item.path}}" mode="aspectFill"></image>
          <view class="image-order-actions"><button class="order-image-btn" data-index="{{index}}" data-direction="up" bindtap="moveMaterialImage">上移</button><button class="order-image-btn" data-index="{{index}}" data-direction="down" bindtap="moveMaterialImage">下移</button></view>
          <button class="remove-image-btn" data-index="{{index}}" bindtap="removeMaterialImage" disabled="{{reviewing}}">移除</button>
        </view>
      </view>
      <textarea class="textarea full-textarea" placeholder="粘贴材料和题目" value="{{paperText}}" bindinput="onPaperTextInput" disabled="{{reviewing}}" maxlength="30000"></textarea>
      <view class="answer-label">参考答案（可选）</view>
      <textarea class="textarea reference-area" placeholder="粘贴官方答案和分值" value="{{referenceText}}" bindinput="onReferenceTextInput" disabled="{{reviewing}}" maxlength="18000"></textarea>
      <button class="btn secondary file-btn" bindtap="openReferencePicker" disabled="{{reviewing}}">选择聊天文件</button>
      <view wx:if="{{referenceFileName}}" class="file-name">已选：{{referenceFileName}}</view>
      <view class="answer-label">文字答案（可选）</view>
      <textarea class="textarea full-textarea answer-area" placeholder="粘贴答案，可分题填写" value="{{answerText}}" bindinput="onAnswerInput" disabled="{{reviewing}}" maxlength="20000"></textarea>
      <button class="btn secondary file-btn" bindtap="chooseAnswerImages" disabled="{{reviewing}}">上传答案图片（最多9张）</button>
      <view wx:if="{{answerImages.length}}" class="answer-image-meta">已选 {{answerImages.length}} 张，按顺序识别。</view>
      <view wx:if="{{answerImages.length}}" class="answer-image-list">
        <view class="answer-image-item" wx:for="{{answerImages}}" wx:key="path">
          <image class="answer-image-preview" src="{{item.path}}" mode="aspectFill"></image>
          <view class="image-order-actions"><button class="order-image-btn" data-index="{{index}}" data-direction="up" bindtap="moveAnswerImage">上移</button><button class="order-image-btn" data-index="{{index}}" data-direction="down" bindtap="moveAnswerImage">下移</button></view>
          <button class="remove-image-btn" data-index="{{index}}" bindtap="removeAnswerImage" disabled="{{reviewing}}">移除</button>
        </view>
      </view>
      <button class="btn" bindtap="submitFullReview" disabled="{{reviewing}}">{{reviewing?'批改中':'开始批改'}}</button>
      <view wx:if="{{reviewing}}" class="upload-tip">{{uploadProgressText || '正在批改，请稍候。'}}</view>
    </view>

    <view class="section card guide-card">
      <view class="section-title">批改内容</view>
      <view class="divider"></view>
      <view class="tip-line">题型：概括、分析、对策、公文、大作文。</view>
      <view class="tip-line">检查：命中、漏点、错点和表达。</view>
      <view class="tip-line">未提供官方标准时，显示估分。</view>
    </view>
  </block>

  <block wx:else>
    <view class="section card">
      <view class="section-title">作文图片</view>
      <view class="card-meta">单张不超过 5MB。</view>
      <view class="divider"></view>
      <input class="input" placeholder="作文题目（可选）" value="{{essayTopic}}" bindinput="onTopicInput" disabled="{{reviewing}}" />
      <view class="mode-title">模式</view>
      <view class="mode-switch">
        <button class="mode-option {{reviewMode=='fast'?'active':''}}" data-mode="fast" bindtap="setReviewMode" disabled="{{reviewing}}">快速</button>
        <button class="mode-option {{reviewMode=='deep'?'active':''}}" data-mode="deep" bindtap="setReviewMode" disabled="{{reviewing}}">深度</button>
      </view>
      <view class="upload-actions">
        <button class="btn upload-btn" disabled="{{reviewing}}" bindtap="chooseEssayImage" data-source="camera">拍照添加</button>
        <button class="btn secondary upload-btn" disabled="{{reviewing}}" bindtap="chooseEssayImage" data-source="album">相册选图</button>
      </view>
      <view wx:if="{{essayImages.length}}" class="answer-image-meta">已选 {{essayImages.length}} 张，按顺序合并。</view>
      <view wx:if="{{essayImages.length}}" class="answer-image-list">
        <view class="answer-image-item" wx:for="{{essayImages}}" wx:key="path">
          <image class="answer-image-preview" src="{{item.path}}" mode="aspectFill"></image>
          <view class="image-order-actions"><button class="order-image-btn" data-index="{{index}}" data-direction="up" bindtap="moveEssayImage">上移</button><button class="order-image-btn" data-index="{{index}}" data-direction="down" bindtap="moveEssayImage">下移</button></view>
          <button class="remove-image-btn" data-index="{{index}}" bindtap="removeEssayImage" disabled="{{reviewing}}">移除</button>
        </view>
      </view>
      <button wx:if="{{essayImages.length}}" class="btn image-review-btn" bindtap="startEssayReview" disabled="{{reviewing}}">{{reviewing?'批改中':'开始批改'}}</button>
      <view wx:if="{{reviewing}}" class="upload-tip">{{uploadProgressText || '正在批改，请稍候。'}}</view>
    </view>
  </block>

  <view class="section card" wx:if="{{essayAnswer}}">
    <view class="result-head">
      <view class="section-title">批改结果</view>
      <view class="result-actions">
        <button class="mini-btn" data-format="docx" bindtap="exportReview">Word</button>
        <button class="mini-btn" data-format="pdf" bindtap="exportReview">PDF</button>
        <button class="mini-btn" bindtap="copyEssayAnswer">复制</button>
      </view>
    </view>
    <view class="divider"></view>
    <view wx:if="{{fullReview && fullReview.overview}}" class="score-summary">
      <view class="score-number">{{fullReview.overview.total_score}}<text wx:if="{{fullReview.overview.total_score_max}}">/{{fullReview.overview.total_score_max}}</text></view>
      <view class="score-label">总分（估）</view>
    </view>
    <rich-text class="rich" nodes="{{essayAnswerHtml}}"></rich-text>
  </view>
</view>
