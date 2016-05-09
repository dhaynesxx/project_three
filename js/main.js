var app = app || {};
    app.position = {};
    // THREE objects
    app.pieceMeshs = [];
    app.boardMeshs = [];
    /// OIMO objects
    app.pieceBodys = [];
    app.boardBodys = [];

    var isMobile = false;
    var antialias = true;

    var geos = {};
    var mats = {};

    //oimo var
    // var world = null;


    var fps = [0,0,0,0];
    var type = 1;
    var infos;

    app.currentRotation = { x:0, y:0, z:0};
    app.mousePosition = { x: 0, y: 0};
    app.ToRad = Math.PI / 180;
    app.ToDeg = 180 / Math.PI;

    app.init = function () {

        app.scene = new THREE.Scene();

        var n = navigator.userAgent;
        // if (n.match(/Android/i) || n.match(/webOS/i) || n.match(/iPhone/i) || n.match(/iPad/i) || n.match(/iPod/i) || n.match(/BlackBerry/i) || n.match(/Windows Phone/i)){ isMobile = true;  antialias = false; document.getElementById("MaxNumber").value = 200; }

        app.infos = document.getElementById("info");

        app.canvas = document.getElementById("canvas");

        app.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 5000 );
        app.camera.position.set( 0, 200, 500 );
        app.camera.lookAt( app.scene.position );

        app.collision = {};
        app.collision.board = 1 << 0;  // 00000000 00000000 00000000 00000001
        app.collision.piece = 1 << 1;  // 00000000 00000000 00000000 00000010
        app.collision.walls = 1 << 1;  // 00000000 00000000 00000000 00000100
        app.collision.all = 0xffffffff; // 11111111 11111111 11111111 11111111

        app.config = [
            1, // The density of the shape.
            0.4, // The coefficient of friction of the shape.
            0.1, // The coefficient of restitution of the shape.
            1, // The bits of the collision groups to which the shape belongs.
            app.collision.all // The bits of the collision groups with which the shape collides.
        ];

        app.renderer = new THREE.WebGLRenderer({ canvas:app.canvas, precision: "mediump", antialias:antialias });
        app.renderer.setSize( window.innerWidth, window.innerHeight );

        app.controls = new THREE.OrbitControls( app.camera, app.renderer.domElement );
        // app.controls.target.set(0, 20, 0);
        // app.controls.update();

        app.axes = new THREE.AxisHelper(400);
        app.scene.add( app.axes );

        var materialType = 'MeshBasicMaterial';

        if(!isMobile){
            app.scene.add( new THREE.AmbientLight( 0x3D4143 ) );
            app.light = new THREE.DirectionalLight( 0xffffff , 1.4);
            app.light.position.set( 300, 1000, 500 );
            app.light.target.position.set( 0, 0, 0 );
            app.light.castShadow = true;
            app.light.shadowCameraNear = 500;
            app.light.shadowCameraFar = 1600;
            app.light.shadowCameraFov = 70;
            app.light.shadowBias = 0.0001;
            app.light.shadowDarkness = 0.7;
            //light.shadowCameraVisible = true;
            app.light.shadowMapWidth = app.light.shadowMapHeight = 1024;
            app.scene.add( app.light );

            materialType = 'MeshPhongMaterial';

            app.renderer.shadowMap.enabled = true;
            app.renderer.shadowMap.type = THREE.PCFShadowMap;//THREE.BasicShadowMap;
        }

        // background
        // var buffgeoBack = new THREE.BufferGeometry();
        // buffgeoBack.fromGeometry( new THREE.IcosahedronGeometry(3000,2) );
        // var back = new THREE.Mesh( buffgeoBack, new THREE.MeshBasicMaterial( { map:gradTexture([[0.75,0.6,0.4,0.25], ['#1B1D1E','#3D4143','#72797D', '#b0babf']]), side:THREE.BackSide, depthWrite: false, fog:false }  ));
        // //back.geometry.applyMatrix(new THREE.Matrix4().makeRotationZ(15*app.ToRad));
        // scene.add( back );

        // geometrys
        geos.sphere = new THREE.BufferGeometry().fromGeometry( new THREE.SphereGeometry(1,16,10));
        geos.box = new THREE.BufferGeometry().fromGeometry( new THREE.BoxGeometry(1,1,1));
        geos.cylinder = new THREE.BufferGeometry().fromGeometry(new THREE.CylinderGeometry(1,1,1));

        // materials
        mats.sph = new THREE[materialType]( {shininess: 10, map: app.basicTexture(0), name:'sph' } );
        mats.ssph = new THREE[materialType]( {shininess: 10, map: app.basicTexture(1), name:'ssph' } );
        mats.ground = new THREE[materialType]( {shininess: 10, color:0x3D4143, transparent:true, opacity:1 } );

        // events

        window.addEventListener( 'resize', app.onWindowResize, false );

        // physics

        app.initOimoPhysics();

    };

    app.loop = function() {
        app.scene.updateMatrixWorld();
        app.updateOimoPhysics();
        app.renderer.render( app.scene, app.camera );
        requestAnimationFrame( app.loop );

    };

    app.onWindowResize = function() {

        app.camera.aspect = window.innerWidth / window.innerHeight;
        app.camera.updateProjectionMatrix();
        app.renderer.setSize( window.innerWidth, window.innerHeight );

    };

    // function addStaticBox(size, position, rotation) {
    //     var mesh = new THREE.Mesh( geos.box, mats.ground );
    //     mesh.scale.set( size[0], size[1], size[2] );
    //     mesh.position.set( position[0], position[1], position[2] );
    //     mesh.rotation.set( rotation[0]*app.ToRad, rotation[1]*app.ToRad, rotation[2]*app.ToRad );
    //     scene.add( mesh );
    //     grounds.push(mesh);
    //     mesh.castShadow = true;
    //     mesh.receiveShadow = true;
    // }

    app.clearMesh = function (){
        var i=app.pieceMeshs.length;
        while (i--) app.scene.remove(app.pieceMeshs[ i ]);
        i = app.boardMeshs.length;
        while (i--) app.scene.remove(app.boardMeshs[ i ]);
        app.boardMeshs = [];
        app.pieceMeshs = [];
    };

    //----------------------------------
    //  OIMO PHYSICS
    //----------------------------------

    app.initOimoPhysics = function (){

        // world setting:( TimeStep, BroadPhaseType, Iterations )
        // BroadPhaseType can be
        // 1 : BruteForce
        // 2 : Sweep and prune , the default
        // 3 : dynamic bounding volume tree

        app.world = new OIMO.World(1/60, 2, 8);
        app.populate(1);
        //setInterval(updateOimoPhysics, 1000/60);

    };

    app.populate = function (n) {

        app.max = 1;
        var size = [];
        var pos = [];
        var rot = [];

        type = 1;

        // reset old
        app.clearMesh();
        app.world.clear();
        app.pieceBodys=[];

        app.boardTHREE = new THREE.Object3D();

        //add ground
        size = [ 400, 80, 400];
        pos = [ 0, -40, 0];
        rot = [ 0, 0, 0];

        // add to world
        app.config[3] = app.collision.board;
        app.boardBodys[0] = app.world.add({size:size, pos:pos, rot:rot, config:app.config, world:app.world, name: 'ground'});

        // add to scene
        var groundGeometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
        var groundMaterial = new THREE.MeshLambertMaterial({
            color: 0xFF8F00
        });
        var groundTHREE = new THREE.Mesh( groundGeometry, groundMaterial );
        groundTHREE.position.set( pos[0], pos[1], pos[2] );
        groundTHREE.rotation.set( rot[0], rot[1], rot[2]);
        groundTHREE.recieveShadow = true;
        app.boardMeshs[0] = groundTHREE;
        app.boardTHREE.add ( groundTHREE );

        //add North Wall
        size = [ 400, 20, 10];
        pos = [ 0, 9, -195];
        rot = [ 0, 0, 0];

        // add to world
        app.config[3] = app.collision.walls;
        app.boardBodys[1] = app.world.add({size: size, pos: pos, rot: rot, config:app.config, world:app.world, name: 'wallNorth'});
        // app.boardOIMO = app.world.add({ type: 'joint', body1: 'ground', body2: 'wallNorth', pos1: [ 0, 40, -195], pos2: [ 0, -10, 0 ],axe1:[1,1,1], axe2:[1,1,1], collision: true, spring:false, min: 0.001, max: 0.001 });

        // add to scene
        var wallNorthGeometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
        var wallNorthMaterial = new THREE.MeshLambertMaterial({
            color: 0xFF69B4
        });
        var wallNorthTHREE = new THREE.Mesh( wallNorthGeometry, wallNorthMaterial );
        wallNorthTHREE.position.set( pos[0], pos[1], pos[2] );
        wallNorthTHREE.rotation.set( rot[0], rot[1], rot[2] );
        wallNorthTHREE.recieveShadow = true;
        app.boardMeshs[1] = wallNorthTHREE;
        app.boardTHREE.add ( wallNorthTHREE );

        //add South Wall
        size = [ 370, 20, 10];
        pos = [ 15, 10, 195];
        rot = [ 0, 0, 0];

        app.config[3] = app.collision.board;
        app.wallSouthOIMO = app.world.add({size: size, pos: pos, rot: rot, config:app.config, world:app.world});

        var wallSouthGeometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
        var wallSouthMaterial = new THREE.MeshLambertMaterial({
            color: 0xFF69B4
        });

        var wallSouthTHREE = new THREE.Mesh( wallSouthGeometry, wallSouthMaterial );
        wallSouthTHREE.position.set( pos[0], pos[1], pos[2] );
        wallSouthTHREE.rotation.set( rot[0], rot[1], rot[2] );
        wallSouthTHREE.recieveShadow = true;
        app.boardTHREE.add( wallSouthTHREE );

        //add West Wall
        size = [ 10, 20, 400];
        pos = [ -195, 10, 0];
        rot = [ 0, 0, 0];

        app.config[3] = app.collision.board;
        app.wallWestOIMO = app.world.add({size: size, pos: pos, rot: rot, config:app.config, world:app.world});

        var wallWestGeometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
        var wallWestMaterial = new THREE.MeshLambertMaterial({
            color: 0xFF69B4
        });

        var wallWestTHREE = new THREE.Mesh( wallWestGeometry, wallWestMaterial );
        wallWestTHREE.position.set( pos[0], pos[1], pos[2] );
        wallWestTHREE.rotation.set( rot[0], rot[1], rot[2] );
        wallWestTHREE.recieveShadow = true;
        app.boardTHREE.add( wallWestTHREE );

        //add East Wall
        size = [ 10, 20, 400];
        pos = [ 195, 10, 0];
        rot = [ 0, 0, 0];

        app.config[3] = app.collision.board;
        app.wallEastOIMO = app.world.add({size: size, pos: pos, rot: rot, config:app.config, world:app.world});

        var wallEastGeometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
        var wallEastMaterial = new THREE.MeshLambertMaterial({
            color: 0xFF69B4
        });

        var wallEastTHREE = new THREE.Mesh( wallEastGeometry, wallEastMaterial );
        wallEastTHREE.position.set( pos[0], pos[1], pos[2] );
        wallEastTHREE.rotation.set( rot[0], rot[1], rot[2] );
        wallEastTHREE.recieveShadow = true;
        app.boardTHREE.add( wallEastTHREE );

        app.scene.add( app.boardTHREE );

        //add piece
        var i, x, y, z, w;
        i = 0;
        x = -100 + Math.random();//*200;
        z = -100; //+ Math.random()*200;
        y = 100  + Math.random()*50;
        w = 10 + Math.random()*10;

        app.config[3] = app.collision.piece;
        app.pieceBodys[i] = app.world.add({type:'sphere', size:[w*0.5], pos:[x,y,z],config: app.config, move:true, noSleep: true, world:app.world, name: 'ball'});
        app.pieceMeshs[i] = new THREE.Mesh( geos.sphere, mats.sph );
        app.pieceMeshs[i].scale.set( w*0.5, w*0.5, w*0.5 );

        app.pieceMeshs[i].castShadow = true;
        app.pieceMeshs[i].receiveShadow = true;

        app.scene.add( app.pieceMeshs[i] );

    };

    app.updateOimoPhysics = function () {
        if ( app.world === null ) return;

        app.world.step();

        if ( app.world.checkContact('ground', 'wallNorth') ) {
            console.log("alknalkna")
        }


        /// update pieces
        for (var i = 0; i < app.pieceBodys.length; i++) {

            // links render and physics objects
            app.pieceMeshs[i].position.copy(app.pieceBodys[i].getPosition());
            app.pieceMeshs[i].quaternion.copy(app.pieceBodys[i].getQuaternion());


            // reset position
            if(app.pieceMeshs[i].position.y<-100){
                var x = -100 + Math.random()*200;
                var z = -100 + Math.random()*200;
                var y = 100 + Math.random()*1000;
                app.pieceBodys[i].resetPosition(x,y,z);
            }
        }
        /// update board
        for (var j = 0; j < app.boardBodys.length; j++) {
            var body = app.boardBodys[j];
            var mesh = app.boardTHREE.children[j];

            var position = new THREE.Vector3().setFromMatrixPosition( mesh.matrixWorld );
            var orientation = new THREE.Quaternion().setFromRotationMatrix(mesh.matrixWorld);



            body.setPosition( position );
            // body.position.x = position.x;
            // body.position.y = position.y / 100;
            // body.position.z = position.z / 100;
            body.resetQuaternion();
            body.controlRot = true;
            body.isDynamic = true;
            body.resetQuaternion( new OIMO.Quat(mesh.quaternion._w, mesh.quaternion._x, mesh.quaternion._y, mesh.quaternion._z));
            body.setQuaternion( orientation );
            // body.controlRot = true;
            // body.newOrientation.x = orientation.x;
            // body.newOrientation.y = orientation.y;
            // body.newOrientation.s = orientation.w;
            // //
            // body.orientation.x = orientation.x;
            // body.orientation.y = orientation.y;
            // body.orientation.s = orientation.w;


            body.syncShapes();

        }

        var body = app.boardBodys[1];
        var mesh = app.boardTHREE.children[1];
        var position = new THREE.Vector3().setFromMatrixPosition( mesh.matrixWorld );
        var quaternion = new THREE.Quaternion().setFromRotationMatrix( mesh.matrixWorld );

        if (app.position.z !== position.z) {
            // console.log('mesh: ', position);
            // console.log('body: ', body.getPosition());
            // console.log('body: ', body.getQuaternion());

            app.position = position;
        }

        $('#mesh-position-value').text( position.x + ', ' +  position.y + ', ' +  position.z );
        $('#body-position-value').text(body.getPosition().x + ', ' +  body.getPosition().y + ', ' + body.getPosition().z );
        $('#mesh-quaternion-value').text(quaternion.x + ', ' +  quaternion.y + ', ' +  quaternion.z + ', ' +  quaternion.w);
        $('#body-quaternion-value').text(body.getQuaternion().x + ', ' + body.getQuaternion().y + ', ' + body.getQuaternion().z + ', ' + body.getQuaternion().w);



        // app.infos.innerHTML = app.world.performance.show();
    };

    app.gravity = function (g){
        nG = -10;
        app.world.gravity = new OIMO.Vec3(0, nG, 0);
    };

    //----------------------------------
    //  TEXTURES
    //----------------------------------

    // function gradTexture(color) {
    //     var c = document.createElement("canvas");
    //     var ct = c.getContext("2d");
    //     var size = 1024;
    //     c.width = 16; c.height = size;
    //     var gradient = ct.createLinearGradient(0,0,0,size);
    //     var i = color[0].length;
    //     while(i--){ gradient.addColorStop(color[0][i],color[1][i]); }
    //     ct.fillStyle = gradient;
    //     ct.fillRect(0,0,16,size);
    //     var texture = new THREE.Texture(c);
    //     texture.needsUpdate = true;
    //     return texture;
    // }

    app.basicTexture = function (n){
        var canvas = document.createElement( 'canvas' );
        canvas.width = canvas.height = 64;
        var ctx = canvas.getContext( '2d' );
        var color;
        if(n===0) color = "#3884AA";// sphere58AA80
        if(n===1) color = "#61686B";// sphere sleep
        if(n===2) color = "#AA6538";// box
        if(n===3) color = "#61686B";// box sleep
        // if(n===4) color = "#AAAA38";// cyl
        // if(n===5) color = "#61686B";// cyl sleep
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillRect(32, 32, 32, 32);

        var tx = new THREE.Texture(canvas);
        tx.needsUpdate = true;
        return tx;
    };

    app.moveGround = function (x, y, z) {
        app.currentRotation = { x:x, y:y, z:z};
        //Change Ground
        app.boardTHREE.rotation.set( app.ToRad * x, app.ToRad * y, app.ToRad * z);
        app.updateOimoPhysics();
        // app.boardBodys[0].resetRotation(x,y,z);
    };

    app.MoveDeg = function(pos, sign) {
        if (pos === 0) {
            return 1;
        } else if (pos === 1 && sign === '-') {
            return 1;
        } else if (pos === -1 && sign === '+') {
            return 1;
        } else {
            return 1;
        }
    };

    app.init();
    app.loop();

    /////////////  Keyboard moves
    $('body').keydown(function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.keyCode === 37) {  //left key
            app.moveGround(app.currentRotation.x, app.currentRotation.y, app.currentRotation.z + app.MoveDeg((app.currentRotation.z),'+'));
        }
        else if (e.keyCode === 38) {  // up key

            app.moveGround(app.currentRotation.x - app.MoveDeg((app.currentRotation.x),'-'), app.currentRotation.y, app.currentRotation.z);
        }
        else if (e.keyCode === 39) {  // right key
            app.moveGround(app.currentRotation.x, app.currentRotation.y, app.currentRotation.z - app.MoveDeg((app.currentRotation.z),'-'));
        }
        else if (e.keyCode === 40) {   // down key

            app.moveGround(app.currentRotation.x + app.MoveDeg((app.currentRotation.x),'+'), app.currentRotation.y, app.currentRotation.z);
        }
    });

    /////////////////// mouse move controls

    var xMoveDegInPix = window.innerWidth / (180/1);
    var zMoveDegInPix = window.innerHeight / (180/1);

    // document.onmousemove = function(e) {
    //     if (document.mousedown === true) {
    //         return;
    //     } else if (app.mousePosition.x + xMoveDegInPix < e.screenX) { // right mouse
    //         app.mousePosition.x = e.screenX;
    //         app.moveGround(app.currentRotation.x, app.currentRotation.y, app.currentRotation.z - app.MoveDeg((app.currentRotation.z),'-'));
    //     } else if (app.mousePosition.x - xMoveDegInPix > e.screenX) {  // left mouse
    //         app.mousePosition.x = e.screenX;
    //         app.moveGround(app.currentRotation.x, app.currentRotation.y, app.currentRotation.z + app.MoveDeg((app.currentRotation.z),'+'));
    //     } else if (app.mousePosition.y + zMoveDegInPix < e.screenY) {  // down mouse
    //         app.mousePosition.y = e.screenY;
    //         app.moveGround(app.currentRotation.x + app.MoveDeg((app.currentRotation.x),'+'), app.currentRotation.y, app.currentRotation.z);
    //     } else if (app.mousePosition.y - zMoveDegInPix > e.screenY) {   // up mouse
    //         app.mousePosition.y = e.screenY;
    //         app.moveGround(app.currentRotation.x - app.MoveDeg((app.currentRotation.x),'-'), app.currentRotation.y, app.currentRotation.z);
    //     }
    // };
