<?php

use yii\helpers\Html;
use yii\grid\GridView;

/* @var $this yii\web\View */
/* @var $dataProvider yii\data\ActiveDataProvider */

$this->title = Yii::t('app', 'Contents');
$this->params['breadcrumbs'][] = $this->title;
?>
<div class="content-index">

    <h1><?= Html::encode($this->title) ?></h1>

    <?= GridView::widget([
        'dataProvider' => $dataProvider,
        'columns' => [
            'name',
            'description',
            'type.name',
            [
                'label' => Yii::t('app', 'Flow'),
                'attribute' => 'flow.name',
                'format' => 'html',
                'value' => function ($model) {
                    return Html::a($model->flow->name, ['flow/view', 'id' => $model->flow->id]);
                },
            ],
            [
                'class' => 'yii\grid\ActionColumn',
                'template' => '{view} {update} {delete} {toggle}',
                'buttons' => [
                    'toggle' => function ($url, $model) {
                        return Html::a('<span class="glyphicon glyphicon-'.($model->enabled ? 'pause' : 'play').'"></span>', $url);
                    },
                ],
            ],
        ],
    ]); ?>
</div>
