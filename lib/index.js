"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (babel) {
  var t = babel.types;


  return {
    visitor: {
      IfStatement: function IfStatement(path) {
        if (!t.isBlockStatement(path.node.consequent)) {
          path.node.consequent = t.blockStatement([path.node.consequent]);
        }
      },
      ForStatement: function ForStatement(path) {
        if (!t.isBlockStatement(path.node.body)) {
          path.node.body = t.blockStatement([path.node.body]);
        }
      },
      WhileStatement: function WhileStatement(path) {
        if (!t.isBlockStatement(path.node.body)) {
          path.node.body = t.blockStatement([path.node.body]);
        }
      },
      ArrowFunctionExpression: function ArrowFunctionExpression(path) {
        if (!t.isBlockStatement(path.node.body)) {
          path.node.body = t.blockStatement([t.returnStatement(path.node.body)]);
        }
      },
      CallExpression: function CallExpression(path) {
        var parent = path.getStatementParent();

        // Don't modify if in ternary
        var excludeTernary = path.findParent(function (path) {
          return path.isConditionalExpression();
        });
        if (excludeTernary) return;

        var comments = void 0;
        if ((comments = parent.node.leadingComments) && comments[comments.length - 1] && /^\s*O:\s*KEEP/.test(comments[comments.length - 1].value)) {
          return;
        }

        var originalExpression = path.node.arguments[0];
        if (checkName(path) && path.node.arguments.length === 1 && t.isExpression(originalExpression.body) && originalExpression.params[0].type === 'Identifier') {
          var name = path.node.callee.property.name;

          var arrayName = path.node.callee.object.name ? t.identifier(path.node.callee.object.name) : null;
          var resArrName = path.scope.generateUidIdentifier("r");
          var iterator = path.scope.generateUidIdentifier("i");
          var action = originalExpression.body;

          var resArray = name === "forEach" ? [] : [t.variableDeclaration("const", [t.variableDeclarator(resArrName, t.arrayExpression())])];

          if (arrayName == null) {
            arrayName = path.scope.generateUidIdentifier("a");
            resArray.push(t.variableDeclaration("const", [t.variableDeclarator(arrayName, path.node.callee.object)]));
          }

          var expr = t.callExpression(t.memberExpression(resArrName, t.identifier("push")), [action]);

          var forBodyDeclarations = [t.variableDeclarator(t.identifier(originalExpression.params[0].name), t.memberExpression(arrayName, iterator, true))];

          if (originalExpression.params[1]) {
            forBodyDeclarations.push(t.variableDeclarator(t.identifier(originalExpression.params[1].name), iterator));
          }
          if (originalExpression.params[2]) {
            forBodyDeclarations.push(t.variableDeclarator(t.identifier(originalExpression.params[2].name), arrayName));
          }

          var forBody = [t.variableDeclaration("const", forBodyDeclarations), t.expressionStatement(name === "forEach" ? action : expr)];

          path.getStatementParent().insertBefore([].concat(resArray, [t.forStatement(t.variableDeclaration("let", [t.variableDeclarator(iterator, t.numericLiteral(0))]), t.binaryExpression('<', iterator, t.memberExpression(arrayName, t.identifier('length'))), t.updateExpression('++', iterator), t.blockStatement(forBody))]));

          path.replaceWith(name === "forEach" ? t.identifier("undefined") : resArrName);
        }
      }
    }
  };
};

var FUNCS = ["map", "forEach"];

function checkName(path) {
  return path.node.callee.property && FUNCS.indexOf(path.node.callee.property.name) > -1;
}