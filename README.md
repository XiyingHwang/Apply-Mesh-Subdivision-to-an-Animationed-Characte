# Mesh Subdivision Project

In this assignment, you will load, process and display mesh files.  The sample code has functionality to load and display objects, and displays a simple 3D model of the letter "F" at startup (so something is loaded and displays when you run the code, and so you can see what a model should look like when displayed).

Your task is to process the triangle mesh that is loaded from a model file in the web directory.  The files are JSON files that contain a list of vertices and triangles.  At the top of the html page is a dropdown menu for a set of models.  Selecting one will fill in the name of the json file in the models/ folder, and hitting the "Load" button will call the ```.onLoad()``` method in app.ts.   The function is set up to use ```loader.ts``` to load and do simple validation of the JSON file (so that you can assume the vertex array contains arrays of three numbers for each vertex, and the triangle array contains arrays of three numbers for each triangle.)

I have tried to make the sample program as complete as possible (regarding the rendering components) so that you can focus on mesh manipulation.

## Due: Monday November 11th, 11:59pm

## Overview 

The assignment requires you to do two things:
1. process the vertex/triangle data so it can be displayed properly
2. subdivide the surface into a smoother surface when the user clicks a button (a mesh could be subdivided repeatedly)

To display a model, you need to
1. convert the model arrays returned by the loader into a format suitable for rendering with WebGL (done for you in sample code)
2. build the vertex corner/opposite tables as discussed in class and in Jarek's notes, and implement the corner table functions (you must implement this)
3. use the corner table to compute a vertex normal for each vertex, based on the surface normals of the triangles that use it (you must implement this; the sample code computes normals a different way)
4. create a random color for each vertex so that the structure of the mesh is obvious (done for you in sample code)

You should submit the full project, as in the previous assignments.  

## Files included in the project

The sample program (index.html and app.ts) are detailed and relatively complex.  You should take time to make sure you understand them before diving into the assignment.  The parts of the same project include:
- ```tsd.json```, ```tsconfig.json```, and ```package.json```: the various config files from the previous assignments, used by tsd, tsc, and npm respectively.
- ```app.ts``` and ```index.html```:  the HTML and main typescript files for the project.
- ```loader.ts```: a utility library that can fetch arbitrary files from the web, and fetch and process the JSON model files used by this assignment.  The file loading mechanism is also used to download the vertex and fragment shaders.
- ```f3d.ts```: a utilty library for creating the WebGL data for the 3D "F" model
- ```includes/style.css```: a minimal css file for the project
- ```shaders/```: the directory containing the shaders
- ```models/```: the models for the assignment
- ```resources/```: various resources from the web, used by the project.  ```chroma.js``` and ```gl-matrix.js``` are powerful and popular open source libraries for dealing with color and matrix/vector operations. ```Stats.js``` is a small WebGL performance monitor.   (the are ```.d.ts``` files for all 3 of these included in the tsd.json (which will bein the ```typings``` directory after you run ```tsd install```).
- ```localTypings```: a relatively minimal ```.d.ts``` file for the ```webgl-utils.js``` library that I wrote (should probably be a lot more detailed, but the various utility functions take complex parameters that would be very complicated to account for).

## Models

The model files are a simple JSON object file with three fields: 
- metadata: a simple object with one element, the property ```type``` that should be set to the string ```"triangles"```.  This is used for a simple first check to see if they file is one we are expecting.
- v: an array of vertices.  Each vertex is an array of 3 numbers (3D coordinates).
- t: an array of triangles.  Each triangle is an array of 3 numbers (indices into the vertex list). The triangle vertices are specified in counter-clockwise order.

The loader does some simple validation of the model structure (i.e., verifies the "t" and "v" fields exist, and that they are arrays of arrays of 3 numbers.

## An overview of the Sample Program structure

### High level structure: asynchronous architecture

As part of this assignment, I wanted you to work with a web application that pulls data it needs from the web server. All non-trivial modern web applications pull their content from servers as part of their initialization, and are structured to load as fast as possible.  Creating a program this way requires the program to load it's assets asynchronously, so that the interface appears as soon as it can.  This application demonstrates this in three ways.

First, like most of our previous examples, we load the main .js file (js/app.js, the Javascript generated from our app.ts file) as a module. The app could be configured to load it's other dependencies (webgl-utils.js, gl-matrix.js, chroma.js and Stats.js) as modules, asynchronously, or use a bundler to combine them into one file, but for simplicity, I loaded them directly in the html file using ```<script>``` tags. Loading files using synchronous script tags forces them to load immediately, before the rest of the HTML file loads.  This simplifies the application (because it knows the file has loaded) but increases the amount of time it takes for the HTML page to first render (because it must wait until all scripts have been loaded).  The same goes for ```<img>``` and ```<link>``` tags and other content. Making ```<scripts>``` asynchronous decreases the load time, but adds complexity (because you do not know which finishes first).  Asset bundling and loading systems (like the module system, or older ones like require.js) combine asynchronous loading with strong dependency management, so scripts don't load until the scripts they depend on have loaded.

Second, in app.ts we load our WebGL shader files from the web, rather than embedding them in the HTML page (as many simple WebGL examples do).  Embedding the files in the HTML page is simple, but as your shaders increase in complexity and number, this becomes impractical;  it also makes version control systems like git less useful.  To load these file from the web server, we break our program's main code into two parts.  First, we run the ```initWebGL()``` function, which initializes WebGL and then uses functions in ```loader.ts``` to make download requests for the two shader files.  The ```loader.loadFiles()``` function takes a callback that should be executed when the files have been loaded and a second to be executed if there is a failure. This pattern is often refered to as a "promise" and is common in Javascript programming.  In our case, the contents of the two downloaded files are passed to the success callback as an array called ```shaderText```.  We pass our WebGL handle ```gl``` and this array ```shaderText``` to the second half of our program code, in the ```main()``` function.  That function, in turn calls a nested ```drawScene()``` function with ```requestAnimationFrame()```, kicking off the rendering loop.

Finally, when the ```Load``` button is pressed, the ```window.loadModel()``` function is executed.  It uses a similar programming style to download the requested mesh, this time using ```loaders.loadMesh()``` which takes three callback functions:  onLoad (if successful), onError (if not) and onProgress (called during download to update you on the progress of the download).  You will receive the ```mesh``` object from the JSON load in the ```onLoad()``` method.  You should process it there, and then attach the new object you want rendered to the ```newObject``` global variable;  the ```drawScene()``` callback will swap in that object the next time it renders, and assign it to the ```object``` global variable.   

If our program was more complex and we wanted to further optimize the behavior of our code, and if we were regularly processing large models, we could move the work done during load into a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).  Workers run in a separate thread, as opposed to the single thread all our Javascript currently runs on.

Both ```loader``` functions use the web standard method [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest).  This API is used to issue and manage asynchronous HTTP requests in HTML5/Javascript programs. 

### Interaction

The program uses similar callbacks to the first assignment, to allow the model to be rotated around the X and Y axes. Pay careful attention to the code in the ```if (mouseAngles[0] !== 0 || mouseAngles[1] !== 0) {``` block in the ```drawScene()``` function.  This code is set up to do what most users expect: rotate the model relative to their view of the model, which at any point in time is in world coordinates (to do this, the rotations must take into account the current rotation, not just add new rotations onto the end).

### WebGL structure

This sample uses WebGL's ```gl.drawElements()``` to render a set of triangles specified in an ELEMENT_ARRAY_BUFFER, similar to assignment 2. The data for the rendering (the vertex positions, colors, normals and any other data that might be needed by more complex applications) are stored in data buffers and attached to the variables (attributes) in the shader program. The ELEMENT_ARRAY_BUFFER is a set of indices for the triangles: every three numbers are used by WebGL as the indices into the other buffers as the corners of a triangle.  

## Assignment Details

The assignment requires you to do three things: 
- expand the MeshObject definition to include the "Extended Swing Table" or "Extended Corner Table" arrays, and methods to implement the other necessary adjacency methods discussed in class and in the notes on the web page.
- update the way surface normals are calculated, using these data structures to compute normals per-vertex using corner and swing operations (as discussed in class and in the notes).
- implement butterfly subdivision.

### Extended Swing/Corner Table

In the notes, two specific versions of the adjacency data structures are defined: the Extended Swing Table and Extended Corner Table. In these definitions, some of the data is stored in tables, and others is computed from methods that use this data.  For example, neither stores c.n, c.t, or t.c.  You should add the appropriate array (table) to the MeshObject, and create methods to implement the operations you need to compute normals and do subdivision.

### Normals

The ```onLoad()``` method currently generates the correct normal for each vertex of the loaded model.  You will need to move the normal generation code into a separate method, so it can also be called when you subdivide the object.  In addition, you should change the way you compute normals to leverage the adjacency data structures.  In Jarek's notes (linked from the class schedule), he explains how to create the mesh corner/opposite tables, and how to compute the vertex normal for a corner using those tables. You need to compute the normal for each vertex using that method, without first computing the normals for each triangle.

When you load a model, you should see an object that looks like this (this is for the bunny model):

![scene 1](/img/bunny.png)

You should make sure your new normals result in the same appearance.

You should note a few things about this image.  First, the colors are blended across the surface;  this allows you to see the structure, but not the individual polygons.  You can, however, see the polygon structure on the edge of the object.  Second, the lighting in the shader allows us to see the structure more clearly, because of the surface color is brightest when facing the light, and fades to black as it faces away from the light (giving a simple appearance of "shadows").  Similarly, the use of a specular highlight will allow you to know if your surface normals are pointing out of the object (rather than into the object): if the surface normals point into the object (i.e., are backwards) there won't be any specular highlights.

### Subdivision

The most challenging part of the assignment is subdivision.  The subdivision algorithm is illustrated on Slide 19 of Jarek's  [2019SLIDESTriangleMeshes.pdf](https://cs3451.github.io/assets/2019SLIDESTriangleMeshes.pdf), and algorithmically in these two slides from Jarek's [meshprocessing](https://cs3451.github.io/assets/meshProcessing.pdf) slides:

![slide 1](/img/subdivision1.png)

![slide 2](/img/subdivision2.png)

The first slide shows the effect of the algorithm on a mesh:  each triangle is divided into 4, and the new points are shifted away from the old surface to smooth it out based on local geometry (the ```bulge()``` step in the algorithm).

The second slide shows the entire algorithm, which takes place in 3 steps (```splitEdges()```, ```bugle()``` and ```splitTriangles()```).   You should rewrite this by hand (using more space and proper formatting!) to make sure you understand it.  The algorithm is based entirely on the corner data structures you must implement, with a few additions:
- ```nc``` and ```nv``` are the number of corners and vertices
- ```G``` is the geometry table, ```V``` is the vertex table, and they are expanded as needed by the algorithm
- ```W``` is a new array to store the new vertex indices, and ```w()``` is the accessor for it (akin to ```v()```)
- ```vector.addScaledVec(scale, vector2)``` adds a scaled version of vector2 to vector
- ```midPt(v1, v2)``` computes the midpoint between v1 and v2
- ```vector.vecTo(vector2)``` computes a vector from vector to vector2

Pay careful attention to the details and make sure you understand what the algorithm is doing.  (Hint: the tests ```i<o(i)``` ensure that some operations are only done once on an edge, for one of the corners it is the "opposite of").

When the user hits the ```Subdivide``` button, you should generate a new ```MeshObject``` (and store it in ```newObject```), based on the current ```object```.  This new object will have 4 times as many triangles as the first one.

## Submission

Your grade will be based on satisfying the requirements described above, each of which is worth 1/3 of the grade.

You should submit your entire code directory, as in previous assignments.

**Use the file names we have requested.** (index.html, app.ts).  The TAs need to be able to test your program as follows:

1. cd into the directory and run ```npm install```
2. compile with ```tsc``` and start a web server 
3. open and view the web page ```index.html```

The TAs will at least test your code against the provided models, and will also look at the code to check your implementation of the mesh processing functions (the corner/opposite tables and related functions) that should be used to generate the subdivision algorithm.
