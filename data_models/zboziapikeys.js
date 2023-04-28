module.exports = (sequelize, type) => {
  return sequelize.define('zboziapikeys', {
    id: {
      type: type.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    uuid: {
      type: type.UUID,
      allowNull: false
    },
    Name: {
      type: type.STRING(255),
      allowNull: false
    },
    idProvozovny: {
      type: type.STRING(24),
      allowNull: false
    },
    zboziAPIkey: {
      type: type.STRING(64),
      allowNull: false
    },
    isvalid: {
      type: type.BOOLEAN,
      allowNull: true
    },
    lastCheck: {
      type: type.DATE,
      allowNull: true
    }
  }, {
    indexes: [
      {
        unique: true,
        name: 'IX_zboziAPIkey',
        fields: ['uuid', 'zboziAPIkey']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
