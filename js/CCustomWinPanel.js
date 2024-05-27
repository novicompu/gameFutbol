function CCustomWinPanel(oSpriteBg) {

    var _oBg;
    var _oTitleTextStoke;
    var _oTitleText;
    var _oNewScoreTextStroke;
    var _oNewScoreText;
    var _oBestScoreTextStroke;
    var _oBestScoreText;
    var _oGroup;
    var _oButRestart;
    var _oBestScoresList; // Añadido para mostrar los mejores puntajes

    this._init = function (oSpriteBg) {
        var iSizeFontSecondaryText = 50;

        _oGroup = new createjs.Container();
        _oGroup.alpha = 0;
        _oGroup.visible = false;

        var oFade = new createjs.Shape();
        oFade.graphics.beginFill("black").drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        oFade.alpha = 0.5;
        _oGroup.addChild(oFade);

        _oBg = createBitmap(oSpriteBg);
        _oBg.x = CANVAS_WIDTH_HALF;
        _oBg.y = CANVAS_HEIGHT_HALF;
        _oBg.regX = oSpriteBg.width * 0.5;
        _oBg.regY = oSpriteBg.height * 0.5;
        _oGroup.addChild(_oBg);

        _oTitleTextStoke = new CTLText(_oGroup, 
                    CANVAS_WIDTH / 2 -oSpriteBg.width/2, CANVAS_HEIGHT_HALF-180, oSpriteBg.width, 90, 
                    80, "center", TEXT_COLOR_STROKE, FONT_GAME, 1.1,
                    50, 0,
                    TEXT_GAMEOVER,
                    true, true, false,
                    false );
        
        _oTitleTextStoke.setOutline(6);

        _oTitleText = new CTLText(_oGroup, 
                    CANVAS_WIDTH / 2 -oSpriteBg.width/2, CANVAS_HEIGHT_HALF-180, oSpriteBg.width, 90, 
                    80, "center",TEXT_COLOR, FONT_GAME, 1.1,
                    50, 0,
                    TEXT_GAMEOVER,
                    true, true, false,
                    false );
                    
        _oNewScoreTextStroke = new CTLText(_oGroup, 
                    CANVAS_WIDTH / 2 -oSpriteBg.width/2, CANVAS_HEIGHT_HALF-70, oSpriteBg.width, 50, 
                    50, "center", TEXT_COLOR_STROKE, FONT_GAME, 1.1,
                    50, 0,
                    "",
                    true, true, false,
                    false );
                
        _oNewScoreTextStroke.setOutline(5);

        _oNewScoreText = new CTLText(_oGroup, 
                    CANVAS_WIDTH / 2 -oSpriteBg.width/2, CANVAS_HEIGHT_HALF-70, oSpriteBg.width, 50, 
                    50, "center", TEXT_COLOR, FONT_GAME, 1.1,
                    50, 0,
                    "",
                    true, true, false,
                    false );


        _oBestScoreTextStroke = new CTLText(_oGroup, 
                    CANVAS_WIDTH / 2 -oSpriteBg.width/2+120, CANVAS_HEIGHT_HALF-10, oSpriteBg.width-240, 50, 
                    50, "center", TEXT_COLOR_STROKE, FONT_GAME, 1.1,
                    0, 0,
                    "",
                    true, true, false,
                    false );
                    
        _oBestScoreTextStroke.setOutline(5);

        _oBestScoreText = new CTLText(_oGroup, 
                    CANVAS_WIDTH / 2 -oSpriteBg.width/2+120, CANVAS_HEIGHT_HALF-10, oSpriteBg.width-240, 50, 
                    50, "center", TEXT_COLOR, FONT_GAME, 1.1,
                    0, 0,
                    "",
                    true, true, false,
                    false );

        // Lista de mejores puntajes
        _oBestScoresList = new createjs.Container();
        _oBestScoresList.y = CANVAS_HEIGHT_HALF + 60;
        _oGroup.addChild(_oBestScoresList);

        var oSpriteButRestart = s_oSpriteLibrary.getSprite("but_restart");
        _oButRestart = new CGfxButton(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5 + 120, oSpriteButRestart, _oGroup);
        _oButRestart.pulseAnimation();
        _oButRestart.addEventListener(ON_MOUSE_DOWN, this._onRestart, this);

        _oGroup.on("click", function () {});

        s_oStage.addChild(_oGroup);
    };

    this.unload = function () {
        _oGroup.removeAllEventListeners();
        s_oStage.removeChild(_oGroup);
        if (_oButRestart) {
            _oButRestart.unload();
            _oButRestart = null;
        }
    };

    this.show = function (iScore) {
        _oTitleTextStoke.refreshText(TEXT_GAMEOVER);
        _oTitleText.refreshText(TEXT_GAMEOVER);
    
        _oNewScoreTextStroke.refreshText(TEXT_SCORE + ": " + iScore);
        _oNewScoreText.refreshText(TEXT_SCORE + ": " + iScore);
    
        _oBestScoreTextStroke.refreshText( TEXT_BEST_SCORE + ": " + s_iBestScore);
        _oBestScoreText.refreshText( TEXT_BEST_SCORE + ": " + s_iBestScore);
    
        _oGroup.visible = true;
        createjs.Tween.get(_oGroup).wait(MS_WAIT_SHOW_GAME_OVER_PANEL).to({alpha: 1}, 1250, createjs.Ease.cubicOut).call(this._loadBestScores);
    };

    this._loadBestScores = function () {
        fetch('http://localhost:3001/get-best-scores')
        .then(response => response.json())
        .then(scores => {
            var yPos = 0;
            scores.forEach((score, index) => {
                var text = new createjs.Text(`${index + 1}. ${score.nombre}: ${score.totalScore}`, "30px " + FONT_GAME, "#fff");
                text.y = yPos;
                _oBestScoresList.addChild(text);
                yPos += 40;
            });
        })
        .catch(error => {
            console.error('Error al obtener los mejores puntajes:', error);
        });
    };

    this._onRestart = function () {
        this.unload();
        s_oGame.restartGame();
    };

    this._init(oSpriteBg);

    return this;
}
