window.onload = function() {
  var renderer = new THREE.WebGLRenderer();
  renderer.setSize( 1000, 1000 );
  document.body.appendChild( renderer.domElement );
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(
    35,             // Field of view
    1000 / 1000,      // Aspect ratio
    0.1,            // Near plane
    100000           // Far plane
  );
  camera.position.set( 20000, 20000, 20000 );
  camera.lookAt( scene.position );

  controls = new THREE.OrbitControls( camera );
  controls.addEventListener( 'change', render);

  getData(function(coordinates){
    var routeGeometry = new THREE.Geometry()
    var routeLine = new THREE.Line(routeGeometry, new THREE.LineBasicMaterial({color: 0xffffff}));
    var satellites = initSatellites();
    var route = shortestPath(bfs(formatNodes(coordinates), buildGraph(coordinates)));
    setPointPositions(coordinates, satellites);
    setRouteVertices(route, coordinates, routeGeometry);
    setScene(routeLine, satellites);
    printRoute(route);
  });

  function printRoute(route) {
    console.log(_.reverse(route).join(","));
  }

  function setPointPositions(coordinates, satellites) {
    var i = 0;
    _.forEach(coordinates, function(value, key) {
      satellites[i].position.set(value.x, value.y, value.z);
      i++;
    });
  }

  function setRouteVertices(route, coordinates, geometry) {
    geometry.vertices.push(new THREE.Vector3(coordinates.END.x,coordinates.END.y,coordinates.END.z));
    _.forEach(route, function(value) {
      geometry.vertices.push(new THREE.Vector3(coordinates[value].x,coordinates[value].y,coordinates[value].z));
    });
    geometry.vertices.push(new THREE.Vector3(coordinates.START.x,coordinates.START.y,coordinates.START.z));
  }

  function setScene(routeLine, satellites) {
    var earthGeometry =  new THREE.SphereGeometry( 6371, 40, 40 );
    var earthMaterial  = new THREE.MeshPhongMaterial()
    var earthMesh = new THREE.Mesh(earthGeometry, earthMaterial)
    scene.add(earthMesh)

    scene.add(routeLine);
    for (var i = 0; i <= 21; i++) {
      scene.add(satellites[i]);
    }
    var light = new THREE.AmbientLight( 0x999999 ); // soft white light
    scene.add( light );

    renderer.setClearColor( 0x000000, 1);
  }

  function initSatellites() {
    satellites = [];
    var satelliteGeom =  new THREE.SphereGeometry( 40, 32, 16 );
    var darkMaterial = new THREE.MeshBasicMaterial( { color: 0xdddddd } );
    var blueMaterial = new THREE.MeshBasicMaterial( { color: 0x0000ff } );
    var redMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
    var wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0x555555, transparent: true, opacity: 0.7} );
    for (var i = 0; i <= 19; i++) {
      satellites.push( new THREE.Mesh( satelliteGeom.clone(), darkMaterial ));
    }
    satellites.push( new THREE.Mesh( satelliteGeom.clone(), blueMaterial ));
    satellites.push( new THREE.Mesh( satelliteGeom.clone(), redMaterial ));
    return satellites;
  }

  function readLines(lines) {
    var coordinates = {};
    lines.forEach(function(line) {
      line = line.split(",");
      if (line[0].startsWith("SAT")) {
        coordinates[line[0]] = latLonAltToXyz(parseFloat(line[1]), parseFloat(line[2]), parseFloat(line[3]));
      } else if (line[0].startsWith("ROU")) {
        coordinates["START"] = latLonAltToXyz(parseFloat(line[1]), parseFloat(line[2]), 0.0);
        coordinates["END"] = latLonAltToXyz(parseFloat(line[3]), parseFloat(line[4]), 0.0);
      } else {
        console.log(line[0]);
      }
    });
    return coordinates;
  }

  function getData(cb) {
    $.get( "https://space-fast-track.herokuapp.com/generate", function( data ) {
      var lines;
      lines = data.split("\n");
      cb(readLines(lines));
    });
  }

  function vector(from, to) {
    return {
      i: to.x-from.x,
      j: to.y-from.y,
      k: to.z-from.z
    };
  }

  function crossProduct(a, b) {
    return {
      i: b.j*a.k - b.k*a.j,
      j: b.k*a.i - b.i*a.k,
      k: b.i*a.j - b.j*a.i
    };
  }

  function innerProduct(a, b) {
    return a.i*b.i + a.j*b.j + a.k*b.k;
  }

  function vectorLength(a) {
    return Math.sqrt(a.i*a.i + a.j*a.j + a.k*a.k);
  }

  function calculateDistanceFromOriginToLine(x1, x2) {
    var a = vector(x1, x2);
    var b = vector(x1, {x:0, y:0, z:0});
    var c = vector(x2, {x:0, y:0, z:0});
    var axb = crossProduct(a, b);
    var apb = innerProduct(a, b);
    var apbda = innerProduct(a, b)/Math.pow(vectorLength(a), 2);

    if (apbda < 0) {
      return vectorLength(b);
    } else if (apbda > 1) {
      return vectorLength(c);
    } else {
      return vectorLength(axb)/vectorLength(a);
    }

  }

  function calculateDistanceFromPointToPoint(x1, x2) {
    var a = (x2.x - x1.x);
    var b = (x2.y - x1.y);
    var c = (x2.z - x1.z);
    return Math.sqrt(a * a + b * b + c * c);
  }

  function buildGraph(nodes) {
    var graph = {};

    //format graph with empty neighbours
    _.forEach(nodes, function(x, n){
      graph[n] = {neighbours: []}
    });

    //check which nodes have connection between and build the graph
    _.forEach(nodes, function(x1, n1) {
      _.forEach(nodes, function(x2, n2) {
        if (x1 != x2) {
          var d = calculateDistanceFromOriginToLine(x1, x2);
          var da = calculateDistanceFromPointToPoint(x1, x2);
          if (d >= 6371) graph[n1].neighbours.push({n: n2, d: da});
        }
      });
    });

    return graph;
  }


  function latLonAltToXyz(lat, lon, alt) {
    var xyz = {};
    var rad = 6371;

    var cos_lat = Math.cos(lat * Math.PI / 180.0);
    var sin_lat = Math.sin(lat * Math.PI / 180.0);
    var cos_lon = Math.cos(lon * Math.PI / 180.0);
    var sin_lon = Math.sin(lon * Math.PI / 180.0);

    xyz.x = (rad + alt) * cos_lat * cos_lon;
    xyz.y = (rad + alt) * cos_lat * sin_lon;
    xyz.z = (rad + alt) * sin_lat;

    return xyz;
  }

  function formatNodes(coordinates) {
    var nodes = {}
    _.forEach(coordinates, function(value, key) {
      nodes[key] = {
        c: 0,
        d: -1,
        t: null,
        id: key
      }
    });
    return nodes;
  }

  function bfs(nodes, graph){
    nodes.START.c = 1;
    nodes.START.d = 0;

    var q = ["START"];

    while (q.length > 0) {
      u = q.shift();
      _.forEach(graph[u].neighbours, function(n) {
        if (nodes[n.n].c == 0) {
          nodes[n.n].c = 1;
          nodes[n.n].d = nodes[u].d+1;
          nodes[n.n].t = u;
          q.push(n.n);
        }
      });
      nodes[u].c = -1;
    }
    return nodes;
  }

  function shortestPath(nodes) {
    var u = nodes["END"].t;
    route = [];

    while (u != "START") {
      route.push(u);
      if (nodes[u]) u = nodes[u].t;
      else {
        console.log("no valid route")
        return
      }
    }

    return route;
  }

  function render() {
    renderer.render(scene, camera);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
  }

  render();
};
