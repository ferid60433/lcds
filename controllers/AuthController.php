<?php

namespace app\controllers;

use Yii;
use yii\filters\AccessControl;
use app\models\User;
use app\models\UserLogin;

/**
 * AuthController implements the authentication methods.
 */
class AuthController extends BaseController
{
    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {
        return [
            'access' => [
                'class' => AccessControl::class,
                'only' => ['login', 'logout'],
                'rules' => [
                    ['allow' => true, 'actions' => ['login'], 'roles' => ['?']],
                    ['allow' => true, 'actions' => ['logout'], 'roles' => ['@']],
                ],
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function init()
    {
        parent::init();

        // Catch login event to afterLogin method
        Yii::$app->user->on(\yii\web\User::EVENT_AFTER_LOGIN, ['app\models\User', 'afterLogin']);
    }

    /**
     * Index redirects to login action.
     *
     * @return \yii\web\Response|string redirect or render
     */
    public function actionIndex()
    {
        return $this->actionLogin();
    }

    /**
     * Login an user based on kerberos auth if available, else use login form
     * with LDAP backend if available or DB.
     *
     * @return \yii\web\Response|string redirect or render
     */
    public function actionLogin()
    {
        if (!Yii::$app->user->isGuest) {
            return $this->goBack();
        }

        // Kerberos auth
        $identity = $this->getFromKerberos();
        if ($identity) {
            // Login auto saves in DB
            Yii::$app->user->login($identity, Yii::$app->params['cookieDuration']);

            return $this->goBack();
        }

        // User login form
        $model = new UserLogin();
        if ($model->load(Yii::$app->request->post()) && $model->validate()) {
            // Find in DB/LDAP
            $identity = User::findIdentity($model->username);
            // Authenticate
            if ($identity !== null && $identity->authenticate($model->password)) {
                Yii::$app->user->enableAutoLogin = $model->remember_me;
                // Login auto saves in DB
                Yii::$app->user->login($identity, Yii::$app->params['cookieDuration']);

                return $this->goBack();
            }
            $model->addError('username', Yii::t('app', 'Username or password incorrect'));
        }

        return $this->render('login', [
            'model' => $model,
        ]);
    }

    /**
     * Check for kerberos configuration and try to authenticate user.
     *
     * @return \app\models\User|null found user
     */
    private function getFromKerberos()
    {
        // Kerberos auth
        if (Yii::$app->params['useKerberos'] && isset($_SERVER[Yii::$app->params['kerberosPrincipalVar']])) {
            $username = $_SERVER[Yii::$app->params['kerberosPrincipalVar']];

            // Find in DB/LDAP
            return User::findIdentity($username);
        }
    }

    /**
     * Disconnects current user.
     *
     * @return \yii\web\Response
     */
    public function actionLogout()
    {
        if (Yii::$app->user->isGuest) {
            return $this->goBack();
        }

        Yii::$app->user->logout();

        return $this->goHome();
    }
}
