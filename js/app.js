///<reference path='./typings/tsd.d.ts'/>
///<reference path="./localTypings/webglutils.d.ts"/>
/*
 * Portions of this code are
 * Copyright 2015, Blair MacIntyre.
 *
 * Portions of this code taken from http://webglfundamentals.org, at https://github.com/greggman/webgl-fundamentals
 * and are subject to the following license.  In particular, from
 *    http://webglfundamentals.org/webgl/webgl-less-code-more-fun.html
 *    http://webglfundamentals.org/webgl/resources/primitives.js
 *
 * Those portions Copyright 2014, Gregg Tavares.
 * All rights reserved.
 */
// the model loader
import * as loader from './loader.js';
// the simple "F" model at startup
import * as f3d from './f3d.js';
////////////////////////////////////////////////////////////////////////////////////////////
// stats module by mrdoob (https://github.com/mrdoob/stats.js) to show the performance
// of your graphics
var stats = new Stats();
stats.setMode(1); // 0: fps, 1: ms, 2: mb
stats.domElement.style.position = 'absolute';
stats.domElement.style.right = '0px';
stats.domElement.style.top = '0px';
document.body.appendChild(stats.domElement);
////////////////////////////////////////////////////////////////////////////////////////////
// some simple utilities methods
var rand = function (min, max) {
    if (max === undefined) {
        max = min;
        min = 0;
    }
    return min + Math.random() * (max - min);
};
var randInt = function (range) {
    return Math.floor(Math.random() * range);
};
////////////////////////////////////////////////////////////////////////////////////////////
// get some of our canvas elements that we need
var canvas = document.getElementById("webgl");
var filename = document.getElementById("filename");
var fileSelection = document.getElementById("files");
var progressGuage = document.getElementById("progress");
progressGuage.style.visibility = "hidden";
// when a new mesh comes in, we will process it on the next frame of the update.
// to tell the update we have a new mesh, set the newObject variable to it's data
var newObject = undefined;
// the current object being displayed
var object = undefined;
////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////
// stub's for  callbacks for the model downloader.
////////////////////////////////////////////////////////////////////////////////////////////
// called when the mesh is successfully downloaded
//
// this method currently sets up some of the information needed to render
// TODO:  in this method, you will need to do two things:
// - set up the various adjacency tables (corner, swing or opposite, etc)
// - REWRITE the vertex normal calculation to be done using the data in MeshObject, using
//   the adjacency operators as described in the mesh operations notes. In particular, you
//   should compute the vertex normal directly for each vertex using v.c and by moving around
//   the triangles attached to v using the swing operator.   You are doing this for two reasons:
//   first, as a way to make sure your adjacency tables and operators work, and second,
//   because you need to move the vertex normal calculations out of "onLoad" since they will
//   need to be redone each time you subdivide.
var onLoad = function (mesh) {
    progressGuage.value = 100;
    progressGuage.style.visibility = "hidden";
    console.log("got a mesh: " + mesh);
    // the vertex array and the triangle array are different lengths.
    // we need to create new arrays that are not nested
    // - position: 3 entries per vertex (x, y, z)
    // - normals: 3 entries per vertex (x, y, z), the normal of the corresponding vertex
    // - colors: 4 entries per vertex (r, g, b, a), in the range 0-255
    // - indices: 3 entries per triangle, each being an index into the vertex array.
    var numVerts = mesh.v.length;
    var numTris = mesh.t.length;
    var position = [];
    var normal = []; // TODO: computed here now, will need to be done in
    var color = [];
    var indices = [];
    var corner = [];
    var opposite = [];
    var normals = [];
    // set up position and color arrays
    for (var ii = 0; ii < numVerts; ++ii) {
        // add the vertex to the position array
        position.push(mesh.v[ii][0], mesh.v[ii][1], mesh.v[ii][2]);
        // create a random color for the vertex
        var h = chroma.hsv(rand(360), 0.5, 1);
        var c = h.rgba();
        color.push(c[0], c[1], c[2], 255);
    }
    // set up the indicies array
    for (var ii = 0; ii < numTris; ++ii) {
        // add the index to the indices array
        indices.push(mesh.t[ii][0], mesh.t[ii][1], mesh.t[ii][2]);
    }
    /////////////////////////
    // compute the normals
    var normalVecs = [];
    for (var ii = 0; ii < numVerts; ++ii) {
        // initialize normal's to null vector;  we'll convert this to the correct format below
        normalVecs.push(vec3.create());
    }
    for (var ii = 0; ii < numTris; ++ii) {
        // compute the triangle normal and save in triNormals
        const v1 = vec3.subtract(vec3.create(), mesh.v[mesh.t[ii][1]], mesh.v[mesh.t[ii][0]]);
        const v2 = vec3.subtract(vec3.create(), mesh.v[mesh.t[ii][2]], mesh.v[mesh.t[ii][0]]);
        var n = vec3.cross(vec3.create(), v1, v2);
        // add the polygon normal to each of the vertices
        var n1 = normalVecs[mesh.t[ii][0]];
        vec3.add(n1, n1, n);
        var n2 = normalVecs[mesh.t[ii][1]];
        vec3.add(n2, n2, n);
        var n3 = normalVecs[mesh.t[ii][2]];
        vec3.add(n3, n3, n);
    }
    for (var ii = 0; ii < numVerts; ++ii) {
        n = normalVecs[ii];
        vec3.normalize(n, n);
        normal.push(n[0], n[1], n[2]);
    }
    //compute the normals
    for (var i = 0; i < numVerts; i++) {
        var sum = vec3.create();
        var current = corner[i];
        var iterator = current;
        while (current != iterator) {
            var N = next(iterator);
            var P = previous(iterator);
            var NV = vec3.subtract(vec3.create(), mesh.v[indices[N]], mesh.v[indices[iterator]]);
            var PV = vec3.subtract(vec3.create(), mesh.v[indices[P]], mesh.v[indices[iterator]]);
            var norm = vec3.cross(vec3.create(), NV, PV);
            sum = vec3.add(sum, norm, sum);
            iterator = next(iterator);
        }
        vec3.normalize(sum, sum);
        normals.push(sum[0], sum[1], sum[2]);
    }
    //compute the corners
    for (var i = 0; i < numTris * 3; i++) {
        for (var j = 0; j < numVerts; j++) {
            if (j == indices[i]) {
                corner[j] = i;
            }
        }
    }
    function next(current) {
        return (current + 1) % 3 + (Math.floor(current / 3)) * 3;
    }
    function previous(current) {
        return next(next(current));
    }
    //compute the opposites
    for (var i = 0; i < numTris * 3; i++) {
        for (var j = 0; j < numTris * 3; j++) {
            if (indices[next(i)] == indices[previous(j)] && indices[previous(i)] == indices[next(j)]) {
                opposite[i] = j;
                opposite[j] = i;
            }
        }
    }
    function oppositeCorner(c) {
        return opposite[c];
    }
    function swing(c) {
        return next(oppositeCorner(next(c)));
    }
    function unswing(c) {
        return previous(oppositeCorner(previous(c)));
    }
    ///////////////////////
    // we also want the bounding box of the object (for rendering)
    var xmin = mesh.v[0][0];
    var xmax = mesh.v[0][0];
    var ymin = mesh.v[0][1];
    var ymax = mesh.v[0][1];
    var zmin = mesh.v[0][2];
    var zmax = mesh.v[0][2];
    for (var ii = 1; ii < numVerts; ++ii) {
        var v = mesh.v[ii];
        if (v[0] < xmin)
            xmin = v[0];
        if (v[0] > xmax)
            xmax = v[0];
        if (v[1] < ymin)
            ymin = v[1];
        if (v[1] > ymax)
            ymax = v[1];
        if (v[2] < zmin)
            zmin = v[2];
        if (v[2] > zmax)
            zmax = v[2];
    }
    var bb1 = vec3.fromValues(xmin, ymin, zmin);
    var bb2 = vec3.fromValues(xmax, ymax, zmax);
    // Setup the new object.  you can add more data to this object if you like
    // to help with subdivision (for example)
    newObject = {
        boundingBox: [bb1, bb2],
        scaleFactor: 300 / vec3.distance(bb1, bb2),
        center: [(xmax + xmin) / 2, (ymax + ymin) / 2, (zmax + zmin) / 2],
        numElements: indices.length,
        corner: [],
        opposite: [],
        normals: [],
        arrays: {
            position: new Float32Array(position),
            normal: new Float32Array(normal),
            color: new Uint8Array(color),
            indices: new Uint16Array(indices)
        }
    };
};
// function opposite(current : number) {
//   if (object) {
//   for (var i  = 0; i < object.arrays.indices.length / 3; i++) {
//     for (var j = 0; j < object.arrays.indices.length / 3; j++) {
//         if (indices[next(i)] == indices[previous(j)] && indices[previous(i)] == indices[next(j)]) {
//           return current[i] = j;
//         }
//       }
//     }
//   }
//   return true; //this current's opposite is a "border"
// }
function next(current) {
    return (current + 1) % 3 + (Math.floor(current / 3)) * 3;
}
function previous(current) {
    return next(next(current));
}
var normals;
var indices;
var corner;
//compute the normals
function normal(numVerts, corner, position) {
    // var normals : number[];
    var vector = [];
    for (var j = 0; j < numVerts; j++) {
        vector[j] = vec3.set(vec3.create(), position[j * 3], position[j * 3 + 1], position[j * 3 + 2]);
    }
    for (var i = 0; i < numVerts; i++) {
        // var vector = vec3.set(vec3.create(), position[i * 3], position[i * 3 + 1], position[i * 3 + 2]);
        var sum = vec3.create();
        var current = corner[i];
        var iterator = current;
        while (current != iterator) {
            var N = next(iterator);
            var P = previous(iterator);
            var NV = vec3.subtract(vec3.create(), vector[indices[N]], vector[indices[iterator]]);
            var PV = vec3.subtract(vec3.create(), vector[indices[P]], vector[indices[iterator]]);
            var norm = vec3.cross(vec3.create(), NV, PV);
            sum = vec3.add(sum, norm, sum);
            iterator = next(iterator);
        }
        vec3.normalize(sum, sum);
        normals.push(sum[0], sum[1], sum[2]);
    }
}
// called periodically during download.  Some servers set the file size so
// progres.lengthComputable is true, which lets us compute the progress
var onProgress = function (progress) {
    if (progress.lengthComputable) {
        progressGuage.value = progress.loaded / progress.total * 100;
    }
    console.log("loading: " + progress.loaded + " of " + progress.total + "...");
};
// of there's an error, this will be called.  We'll log it to the console
var onError = function (error) {
    console.log("error! " + error);
};
window.jsonFileChanged = () => {
    // we stored the filename in the select option items value property
    filename.value = fileSelection.value;
};
window.loadModel = () => {
    // reset and show the progress bar
    progressGuage.max = 100;
    progressGuage.value = 0;
    progressGuage.style.visibility = "visible";
    // attempt to download the modele
    loader.loadMesh("models/" + filename.value, onLoad, onProgress, onError);
};
// TODO:  This is where all of your subdivision work will take place.
window.onSubdivide = () => {
    console.log("Subdivide called!  You should do the subdivision!");
    //////////////
    ///////// YOUR CODE HERE TO TAKE THE CURRENT OBJECT and SUBDIVIDE it, creating a newObject
    //////////////
    if (object) {
        // var G : GLM.IArray[] = [];
        var G;
        for (var j = 0; j < object.arrays.position.length / 3; j++) {
            G[j] = vec3.set(vec3.create(), object.arrays.position[j * 3], object.arrays.position[j * 3 + 1], object.arrays.position[j * 3 + 2]);
        }
        function opposite(current) {
            if (object) {
                for (var i = 0; i < object.arrays.indices.length / 3; i++) {
                    for (var j = 0; j < object.arrays.indices.length / 3; j++) {
                        if (object.arrays.indices[next(i)] == object.arrays.indices[previous(j)]
                            && object.arrays.indices[previous(i)] == object.arrays.indices[next(j)]) {
                            return j; // j is the vertice number of the opposite corner
                        }
                    }
                }
            }
            return -1; //this current's opposite is a "border"
        }
        function midPt(a, b) {
            // midPt(v1, v2) computes the midpoint between v1 and v2
        }
        var W;
        function splitEdges() {
            if (object) {
                for (var i = 0; i < object.arrays.indices.length; i++) {
                    if (opposite(i) == -1) { // opposite return false means that corner doesn't have an opposite
                        G[object.arrays.position.length] = midPt(G[next(i)], G[previous(i)]);
                        W[i] = object.arrays.position.length + 1;
                    }
                    else {
                        if (i < opposite(i)) {
                            G[object.arrays.position.length] = midPt(G[next(i)], G[previous(i)]);
                            W[opposite(i)] = object.arrays.position.length;
                            W[i] = object.arrays.position.length + 1;
                        }
                    }
                }
            }
        }
        // function left(current : number) {
        //   return opposite(next(current))
        // } 
        // function right(current : number) {
        //   return opposite(previous(current))
        // }
        function addScaledVec(a, b) {
        }
        function vecTo(vector, vector2) {
        }
        function bulge() {
            if (object) {
                for (var i = 0; i < object.arrays.indices.length; i++) {
                    if ((opposite(i) != -1) && (i < opposite(i))) { // no tweak for mid-vertices of border edges
                        if ((opposite(previous(i)) != -1) && (opposite(next(i)) != -1)
                            && (opposite(previous(opposite(i))) != -1) && (opposite(next(opposite(i))) != -1)) {
                            // G[W[i]].addScaledVec(0.25, midPt(midPt(G[left(i)], G[right(i)]), midPt(G[left(opposite(i))], G[right(opposite(i))])
                            // .vecTo(midPt(G[i], G[opposite(i)]))
                            // G: a copy of the geometry table (MeshObject.arrays.position, maps from vertex number to coordinates)
                            // V: a copy of the vertex table (MeshObject.arrays.indices, maps from corner number to vertex number)
                            // W: a new array to store the new vertex indices
                            // n(i): the next corner, clockwise around the triangle from i
                            // p(i): the previous corner, counterclockwise around the triangle from i
                            // o(i): the corner opposite from corner i
                            // b(i): whether the corner i is opposite a "border" (doesn't have an o(i)
                            // l(i): the corner "left" of c, equivalent to o(n(c))
                            // r(i): the corner "right" of c, equivalent to o(p(c))
                            // nc: number of corners (MeshObject.arrays.indices.length)
                            // nv: number of vertices (MeshObject.arrays.position.length)
                            // vector.addScaledVec(scale, vector2) adds a scaled version of vector2 to vector
                            // vector.vecTo(vector2) computes a vector from vector to vector2
                            G[W[i]] + addScaledVec(0.25);
                            // midPt(midPt(G[opposite((next(i)))], G[opposite(previous(i))])
                            // ,midPt(G[opposite((next(opposite(i))))],G[opposite((previous(opposite(i))))])))
                        }
                    }
                }
            }
        }
        function splitTriangles() {
            if (object) {
                for (var i = 0; i < object.arrays.indices.length; i = i + 3) {
                    object.arrays.indices[object.arrays.indices.length + i] = object.arrays.indices[i];
                    object.arrays.indices[next(object.arrays.indices.length + i)] = W[previous(i)];
                    object.arrays.indices[previous(object.arrays.indices.length + i)] = W[next(i)];
                    object.arrays.indices[2 * object.arrays.indices.length + i] = object.arrays.indices[next(i)];
                    object.arrays.indices[next(2 * object.arrays.indices.length + i)] = W[i];
                    object.arrays.indices[previous(2 * object.arrays.indices.length + i)] = W[previous(i)];
                    object.arrays.indices[3 * object.arrays.indices.length + i] = object.arrays.indices[previous(i)];
                    object.arrays.indices[next(3 * object.arrays.indices.length + i)] = W[next(i)];
                    object.arrays.indices[previous(3 * object.arrays.indices.length + i)] = W[i];
                    object.arrays.indices[i] = W[i];
                    object.arrays.indices[next(i)] = W[next(i)];
                    object.arrays.indices[previous(i)] = W[previous(i)];
                }
                indices.length = 4 * object.arrays.indices.length; // nt = 4 * nt
                corner.length = 3 * object.arrays.indices.length; // nc = 3 * nc
            }
        }
        newObject = {
            boundingBox: [object.boundingBox[0], object.boundingBox[1]],
            scaleFactor: 300 / vec3.distance(object.boundingBox[0], object.boundingBox[1]),
            center: object.center,
            numElements: object.arrays.indices.length,
            corner: [],
            opposite: [],
            normals: [],
            arrays: {
                position: new Float32Array(object.arrays.position),
                normal: new Float32Array(object.arrays.normal),
                color: new Uint8Array(object.arrays.color),
                indices: new Uint16Array(object.arrays.indices)
            }
        };
        // newObject.arrays.indices = split V;
        // newObject.arrays.positions = G;
        // newObject.arrays.normals = normal(G.length, corner(V),G);
    }
};
////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////
// some simple interaction using the mouse.
// we are going to get small motion offsets of the mouse, and use these to rotate the object
//
// our offset() function from assignment 0, to give us a good mouse position in the canvas
function offset(e) {
    e = e || window.event;
    var target = (e.target || e.srcElement), rect = target.getBoundingClientRect(), offsetX = e.clientX - rect.left, offsetY = e.clientY - rect.top;
    return vec2.fromValues(offsetX, offsetY);
}
var mouseStart = undefined; // previous mouse position
var mouseDelta = undefined; // the amount the mouse has moved
var mouseAngles = vec2.create(); // angle offset corresponding to mouse movement
// start things off with a down press
canvas.onmousedown = (ev) => {
    mouseStart = offset(ev);
    mouseDelta = vec2.create(); // initialize to 0,0
    vec2.set(mouseAngles, 0, 0);
};
// stop things with a mouse release
canvas.onmouseup = (ev) => {
    if (mouseStart != undefined && mouseDelta != undefined) {
        const clickEnd = offset(ev);
        vec2.sub(mouseDelta, clickEnd, mouseStart); // delta = end - start
        vec2.scale(mouseAngles, mouseDelta, 10 / canvas.height);
        // now toss the two values since the mouse is up
        mouseDelta = undefined;
        mouseStart = undefined;
    }
};
// if we're moving and the mouse is down
canvas.onmousemove = (ev) => {
    if (mouseStart != undefined && mouseDelta != undefined) {
        const m = offset(ev);
        vec2.sub(mouseDelta, m, mouseStart); // delta = mouse - start
        vec2.copy(mouseStart, m); // start becomes current position
        vec2.scale(mouseAngles, mouseDelta, 10 / canvas.height);
        // console.log("mousemove mouseAngles: " + mouseAngles[0] + ", " + mouseAngles[1]);
        // console.log("mousemove mouseDelta: " + mouseDelta[0] + ", " + mouseDelta[1]);
        // console.log("mousemove mouseStart: " + mouseStart[0] + ", " + mouseStart[1]);
    }
};
// stop things if you move out of the window
canvas.onmouseout = (ev) => {
    if (mouseStart != undefined) {
        vec2.set(mouseAngles, 0, 0);
        mouseDelta = undefined;
        mouseStart = undefined;
    }
};
////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////
// start things off by calling initWebGL
initWebGL();
function initWebGL() {
    // get the rendering context for webGL
    var gl = getWebGLContext(canvas);
    if (!gl) {
        return; // no webgl!  Bye bye
    }
    // turn on backface culling and zbuffering
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    // attempt to download and set up our GLSL shaders.  When they download, processed to the next step
    // of our program, the "main" routing
    loader.loadFiles(['shaders/shader.vert', 'shaders/shader.frag'], function (shaderText) {
        var program = createProgramFromSources(gl, shaderText);
        main(gl, program);
    }, function (url) {
        alert('Shader failed to download "' + url + '"');
    });
}
////////////////////////////////////////////////////////////////////////////////////////////
// webGL is set up, and our Shader program has been created.  Finish setting up our webGL application
function main(gl, program) {
    // use the webgl-utils library to create setters for all the uniforms and attributes in our shaders.
    // It enumerates all of the uniforms and attributes in the program, and creates utility functions to
    // allow "setUniforms" and "setAttributes" (below) to set the shader variables from a javascript object.
    // The objects have a key for each uniform or attribute, and a value containing the parameters for the
    // setter function
    var uniformSetters = createUniformSetters(gl, program);
    var attribSetters = createAttributeSetters(gl, program);
    /// ***************
    /// This code creates the initial 3D "F".  You can look here for guidance on what some of the elements
    /// of the "object" are, and may want to use the debugger to look at the content of the fields of the "arrays"
    /// object returned from f3d.createArrays(gl)
    var arrays = f3d.createArrays(gl);
    var bb1 = vec3.fromValues(100, 150, 30);
    var bb2 = vec3.fromValues(0, 0, 0);
    object = {
        boundingBox: [bb2, bb1],
        scaleFactor: 300 / vec3.distance(bb1, bb2),
        center: [50, 75, 15],
        numElements: arrays.indices.length,
        arrays: arrays,
        corner: [],
        opposite: [],
        normals: [],
    };
    var buffers = {
        position: gl.createBuffer(),
        normal: gl.createBuffer(),
        color: gl.createBuffer(),
        indices: gl.createBuffer()
    };
    object.buffers = buffers;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, arrays.position, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
    gl.bufferData(gl.ARRAY_BUFFER, arrays.normal, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, arrays.color, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrays.indices, gl.STATIC_DRAW);
    var attribs = {
        a_position: { buffer: buffers.position, numComponents: 3, },
        a_normal: { buffer: buffers.normal, numComponents: 3, },
        a_color: { buffer: buffers.color, numComponents: 4, type: gl.UNSIGNED_BYTE, normalize: true }
    };
    function degToRad(d) {
        return d * Math.PI / 180;
    }
    var cameraAngleRadians = degToRad(0);
    var fieldOfViewRadians = degToRad(60);
    var cameraHeight = 50;
    var uniformsThatAreTheSameForAllObjects = {
        u_lightWorldPos: [50, 30, -100],
        u_viewInverse: mat4.create(),
        u_lightColor: [1, 1, 1, 1],
        u_ambient: [0.1, 0.1, 0.1, 0.1]
    };
    var uniformsThatAreComputedForEachObject = {
        u_worldViewProjection: mat4.create(),
        u_world: mat4.create(),
        u_worldInverseTranspose: mat4.create(),
    };
    var baseColor = rand(240);
    var objectState = {
        materialUniforms: {
            u_colorMult: chroma.hsv(rand(baseColor, baseColor + 120), 0.5, 1).gl(),
            u_specular: [1, 1, 1, 1],
            u_shininess: 450,
            u_specularFactor: 0.75,
        }
    };
    // some variables we'll reuse below
    var projectionMatrix = mat4.create();
    var viewMatrix = mat4.create();
    var rotationMatrix = mat4.create();
    var matrix = mat4.create(); // a scratch matrix
    var invMatrix = mat4.create();
    var axisVector = vec3.create();
    requestAnimationFrame(drawScene);
    // Draw the scene.
    function drawScene(time) {
        time *= 0.001;
        // reset the object if a new one has been loaded
        if (newObject) {
            object = newObject;
            newObject = undefined;
            arrays = object.arrays;
            buffers = {
                position: gl.createBuffer(),
                normal: gl.createBuffer(),
                color: gl.createBuffer(),
                indices: gl.createBuffer()
            };
            object.buffers = buffers;
            // For each of the new buffers, load the array data into it.
            // first, bindBuffer sets it as the "current Buffer" and then "bufferData"
            // loads the data into it.  Each array (vertex, color, normal)
            // has the same number of entries, and is used together by the shaders when it's
            // index is referenced by the index array for the triangle list
            // vertex positions
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
            gl.bufferData(gl.ARRAY_BUFFER, arrays.position, gl.STATIC_DRAW);
            // vertex normals
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
            gl.bufferData(gl.ARRAY_BUFFER, arrays.normal, gl.STATIC_DRAW);
            // vertex colors
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
            gl.bufferData(gl.ARRAY_BUFFER, arrays.color, gl.STATIC_DRAW);
            // triangle indices.
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrays.indices, gl.STATIC_DRAW);
            // the attribute data to be used by the "setAttributes" utility function
            attribs = {
                a_position: { buffer: buffers.position, numComponents: 3, },
                a_normal: { buffer: buffers.normal, numComponents: 3, },
                a_color: { buffer: buffers.color, numComponents: 4, type: gl.UNSIGNED_BYTE, normalize: true }
            };
            // reset the rotation matrix
            rotationMatrix = mat4.identity(rotationMatrix);
        }
        // measure time taken for the little stats meter
        stats.begin();
        // if the window changed size, reset the WebGL canvas size to match.  The displayed size of the canvas
        // (determined by window size, layout, and your CSS) is separate from the size of the WebGL render buffers,
        // which you can control by setting canvas.width and canvas.height
        resizeCanvasToDisplaySize(canvas);
        // Set the viewport to match the canvas
        gl.viewport(0, 0, canvas.width, canvas.height);
        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Compute the projection matrix
        var aspect = canvas.clientWidth / canvas.clientHeight;
        mat4.perspective(projectionMatrix, fieldOfViewRadians, aspect, 1, 2000);
        // Compute the camera's matrix using look at.
        var cameraPosition = [0, 0, -200];
        var target = [0, 0, 0];
        var up = [0, 1, 0];
        var cameraMatrix = mat4.lookAt(uniformsThatAreTheSameForAllObjects.u_viewInverse, cameraPosition, target, up);
        // Make a view matrix from the camera matrix.
        mat4.invert(viewMatrix, cameraMatrix);
        // tell WebGL to use our shader program.  probably don't need to do this each time, since we aren't
        // changing it, but it doesn't hurt in this simple example.
        gl.useProgram(program);
        // Setup all the needed attributes.   This utility function does the following for each attribute,
        // where "index" is the index of the shader attribute found by "createAttributeSetters" above, and
        // "b" is the value of the entry in the "attribs" array cooresponding to the shader attribute name:
        //   gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
        //   gl.enableVertexAttribArray(index);
        //   gl.vertexAttribPointer(
        //     index, b.numComponents || b.size, b.type || gl.FLOAT, b.normalize || false, b.stride || 0, b.offset || 0);
        setAttributes(attribSetters, attribs);
        // Bind the indices for use in the index-based drawElements below
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        // Set the uniforms that are the same for all objects.  Unlike the attributes, each uniform setter
        // is different, depending on the type of the uniform variable.  Look in webgl-util.js for the
        // implementation of  setUniforms to see the details for specific types
        setUniforms(uniformSetters, uniformsThatAreTheSameForAllObjects);
        ///////////////////////////////////////////////////////
        // Compute the view matrix and corresponding other matrices for rendering.
        // first make a copy of our rotationMatrix
        mat4.copy(matrix, rotationMatrix);
        // adjust the rotation based on mouse activity.  mouseAngles is set if user is dragging
        if (mouseAngles[0] !== 0 || mouseAngles[1] !== 0) {
            // need an inverse world transform so we can find out what the world X axis for our first rotation is
            mat4.invert(invMatrix, matrix);
            // get the world X axis
            var xAxis = vec3.transformMat4(axisVector, vec3.fromValues(1, 0, 0), invMatrix);
            // rotate about the world X axis (the X parallel to the screen!)
            mat4.rotate(matrix, matrix, -mouseAngles[1], xAxis);
            // now get the inverse world transform so we can find the world Y axis
            mat4.invert(invMatrix, matrix);
            // get the world Y axis
            var yAxis = vec3.transformMat4(axisVector, vec3.fromValues(0, 1, 0), invMatrix);
            // rotate about teh world Y axis
            mat4.rotate(matrix, matrix, mouseAngles[0], yAxis);
            // save the resulting matrix back to the cumulative rotation matrix
            mat4.copy(rotationMatrix, matrix);
            vec2.set(mouseAngles, 0, 0);
        }
        if (object) {
            // add a translate and scale to the object World xform, so we have:  R * T * S
            mat4.translate(matrix, rotationMatrix, [-object.center[0] * object.scaleFactor, -object.center[1] * object.scaleFactor,
                -object.center[2] * object.scaleFactor]);
            mat4.scale(matrix, matrix, [object.scaleFactor, object.scaleFactor, object.scaleFactor]);
            mat4.copy(uniformsThatAreComputedForEachObject.u_world, matrix);
            // get proj * view * world
            mat4.multiply(matrix, viewMatrix, uniformsThatAreComputedForEachObject.u_world);
            mat4.multiply(uniformsThatAreComputedForEachObject.u_worldViewProjection, projectionMatrix, matrix);
            // get worldInvTranspose.  For an explaination of why we need this, for fixing the normals, see
            // http://www.unknownroad.com/rtfm/graphics/rt_normals.html
            mat4.transpose(uniformsThatAreComputedForEachObject.u_worldInverseTranspose, mat4.invert(matrix, uniformsThatAreComputedForEachObject.u_world));
            // Set the uniforms we just computed
            setUniforms(uniformSetters, uniformsThatAreComputedForEachObject);
            // Set the uniforms that are specific to the this object.
            setUniforms(uniformSetters, objectState.materialUniforms);
            // Draw the geometry.   Everything is keyed to the ""
            gl.drawElements(gl.TRIANGLES, object.numElements, gl.UNSIGNED_SHORT, 0);
        }
        // stats meter
        stats.end();
        requestAnimationFrame(drawScene);
    }
}
//# sourceMappingURL=app.js.map