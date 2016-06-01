<?php

namespace app\models;

use Yii;

/**
 * This is the model class for table "screen".
 *
 * @property integer $id
 * @property string $name
 * @property string $description
 * @property integer $template_id
 *
 * @property ScreenTemplate $template
 * @property ScreenHasFlow[] $screenHasFlows
 * @property Flow[] $flows
 */
class Screen extends \yii\db\ActiveRecord
{
    /**
     * @inheritdoc
     */
    public static function tableName()
    {
        return 'screen';
    }

    /**
     * @inheritdoc
     */
    public function rules()
    {
        return [
            [['name', 'template_id'], 'required'],
            [['template_id'], 'integer'],
            [['name'], 'string', 'max' => 64],
            [['description'], 'string', 'max' => 1024],
            [['template_id'], 'exist', 'skipOnError' => true, 'targetClass' => ScreenTemplate::className(), 'targetAttribute' => ['template_id' => 'id']],
        ];
    }

    /**
     * @inheritdoc
     */
    public function attributeLabels()
    {
        return [
            'id' => Yii::t('app', 'ID'),
            'name' => Yii::t('app', 'Name'),
            'description' => Yii::t('app', 'Description'),
            'template_id' => Yii::t('app', 'Template ID'),
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getTemplate()
    {
        return $this->hasOne(ScreenTemplate::className(), ['id' => 'template_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getScreenHasFlows()
    {
        return $this->hasMany(ScreenHasFlow::className(), ['screen_id' => 'id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getFlows()
    {
        return $this->hasMany(Flow::className(), ['id' => 'flow_id'])->viaTable('screen_has_flow', ['screen_id' => 'id']);
    }
}
